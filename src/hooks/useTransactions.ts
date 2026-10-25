"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { inChunks } from "@/lib/batches";
import { toTransaction, waitingLineDocs } from "@/lib/waiting-lines";
import { Category, OcrLine, Transaction } from "@/types";

const transactionsRef = collection(db, "transactions");

/** How long a waiting line's edits wait for more typing before they are written. */
export const EDIT_DELAY_MS = 400;
/** How long a failed edit waits before it is written again. */
export const RETRY_DELAY_MS = 5000;

/** The fields the spend form edits. */
export type SpendFields = Pick<
  Transaction,
  "amount" | "store" | "description" | "categoryId" | "date"
>;

/** Waiting lines keep the order they arrived in: screenshot by screenshot, then the bank's order. */
export function byArrival(a: Transaction, b: Transaction) {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return (a.seq ?? 0) - (b.seq ?? 0);
}

/** Why a line can't be saved as a spend yet, or null when it can. */
export function cannotSave(line: Transaction): string | null {
  // Same order as the needs-a-look reasons in src/lib/review.ts.
  if (line.status === "pending_review" && !line.kept) {
    if (line.ownTransfer) return "own transfer";
    if (line.direction === "in") return "incoming";
  }
  if (line.amount === null || !(line.amount > 0)) return "no amount";
  if (!line.store.trim()) return "no store";
  if (!line.date) return "no date";
  if (!line.categoryId) return "no category";
  return null;
}

class NotReadyError extends Error {
  constructor(line: Transaction, reason: string) {
    super(`Transaction ${line.id} can't be accepted yet: ${reason}`);
    this.name = "NotReadyError";
  }
}

function checkSpend(fields: SpendFields) {
  const reason = cannotSave({
    ...fields,
    id: "new",
    source: "manual",
    status: "confirmed",
    createdAt: "",
  });
  if (reason) throw new Error(`This spend can't be saved: ${reason}`);
}

function editPayload(patch: Partial<SpendFields>) {
  // Touching the category ends "Suggested from the store name".
  return "categoryId" in patch
    ? { ...patch, categorySuggested: deleteField() }
    : { ...patch };
}

/** A line is kept as typed while waiting; it is saved as a spend without stray spaces. */
function trimmed(line: Pick<Transaction, "store" | "description">) {
  return { store: line.store.trim(), description: line.description.trim() };
}

async function writeEdit(id: string, patch: Partial<SpendFields>) {
  await updateDoc(doc(transactionsRef, id), editPayload(patch));
}

/** The line is gone (thrown away or accepted elsewhere): there is nothing left to keep edits for. */
function lineIsGone(err: unknown) {
  return (err as { code?: unknown } | null)?.code === "not-found";
}

export function useTransactions() {
  const [stored, setStored] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // A write that failed. Kept apart from `error`, which means the data couldn't load.
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edits to waiting lines, kept here until they are written. They show in
  // the lists straight away; the write waits for a pause in typing.
  const pending = useRef(new Map<string, Partial<SpendFields>>());
  // Edits that have been sent and are waiting for the write to be acknowledged. They stay on top of
  // the stored data until then, so a line never shows its old values for a moment in between.
  const written = useRef(new Map<string, Partial<SpendFields>>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [, setPendingVersion] = useState(0);
  const bumpPending = () => setPendingVersion((v) => v + 1);

  useEffect(() => {
    const q = query(transactionsRef, orderBy("date", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setStored(snap.docs.map((d) => toTransaction(d.id, d.data())));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("transactions onSnapshot failed:", err);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const edits = pending.current;
    const waits = timers.current;
    // Leaving the screen never loses typing: write what is left.
    return () => {
      waits.forEach(clearTimeout);
      waits.clear();
      edits.forEach((patch, id) => {
        writeEdit(id, patch).catch((err) =>
          console.error("saving an edit on leave failed:", err)
        );
      });
      edits.clear();
    };
  }, []);

  const transactions =
    pending.current.size || written.current.size
      ? stored.map((t) => {
          const sent = written.current.get(t.id);
          const typed = pending.current.get(t.id);
          if (!sent && !typed) return t;
          const patch = { ...sent, ...typed };
          const next = { ...t, ...patch };
          if ("categoryId" in patch) delete next.categorySuggested;
          return next;
        })
      : stored;
  const spends = transactions.filter((t) => t.status === "confirmed");
  const waiting = transactions
    .filter((t) => t.status === "pending_review")
    .sort(byArrival);

  function find(id: string) {
    const line = transactions.find((t) => t.id === id);
    if (!line) throw new Error(`Transaction ${id} not found`);
    return line;
  }

  function takePending(id: string) {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    const patch = pending.current.get(id);
    pending.current.delete(id);
    return patch;
  }

  /** A write is over: its edits no longer need to sit on top of the stored data (unless a newer write holds them). */
  function settle(id: string, sent: Partial<SpendFields>) {
    if (written.current.get(id) !== sent) return;
    written.current.delete(id);
    bumpPending();
  }

  /** Puts back edits whose write failed, under anything typed since, so nothing typed is lost. */
  function restorePending(id: string, patch: Partial<SpendFields> | undefined, err: unknown) {
    if (!patch || lineIsGone(err)) return;
    pending.current.set(id, { ...patch, ...pending.current.get(id) });
    bumpPending();
  }

  /**
   * Adds the lines read from one screenshot as waiting lines, in the screenshot's order. Returns their
   * `createdAt`, which is how the lines of this batch are told apart from older ones.
   */
  async function addScreenshotLines(lines: OcrLine[], categories: Category[]): Promise<string> {
    const createdAt = new Date().toISOString();
    const docs = waitingLineDocs(lines, {
      spends,
      categoryIds: new Set(categories.map((c) => c.id)),
      createdAt,
    });
    for (const chunk of inChunks(docs)) {
      const batch = writeBatch(db);
      for (const data of chunk) batch.set(doc(transactionsRef), data);
      await batch.commit();
    }
    return createdAt;
  }

  /** Changes a waiting line as the owner types; written after a short pause. */
  function editWaitingLine(id: string, patch: Partial<SpendFields>) {
    pending.current.set(id, { ...pending.current.get(id), ...patch });
    flushLater(id, EDIT_DELAY_MS);
    bumpPending();
  }

  // A failed write is put back (restorePending) and tried again after a longer pause, so typing that
  // couldn't be saved isn't left waiting for the next keystroke.
  function flushLater(id: string, delay: number) {
    const old = timers.current.get(id);
    if (old) clearTimeout(old);
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        flushEdits(id).catch((err) => {
          console.error("saving an edit failed:", err);
          setSaveError(err.message);
          if (pending.current.has(id) && !timers.current.has(id)) flushLater(id, RETRY_DELAY_MS);
        });
      }, delay)
    );
  }

  /** Writes waiting-line edits now: one line's, or every line's. */
  async function flushEdits(id?: string) {
    const ids = id ? [id] : [...pending.current.keys()];
    const writes = ids.flatMap((lineId) => {
      const patch = takePending(lineId);
      if (!patch) return [];
      const sent = { ...written.current.get(lineId), ...patch };
      written.current.set(lineId, sent);
      return [
        writeEdit(lineId, patch).then(
          () => settle(lineId, sent),
          (err) => {
            settle(lineId, sent);
            restorePending(lineId, patch, err);
            throw err;
          }
        ),
      ];
    });
    if (!writes.length) return;
    bumpPending();
    await Promise.all(writes);
    setSaveError(null);
  }

  /** Saves one waiting line as a spend, with any edits not yet written. */
  async function acceptLine(id: string) {
    const line = find(id);
    const reason = cannotSave(line);
    if (reason) throw new NotReadyError(line, reason);
    const patch = takePending(id);
    bumpPending();
    try {
      await updateDoc(doc(transactionsRef, id), {
        ...editPayload(patch ?? {}),
        ...trimmed(line),
        status: "confirmed",
      });
    } catch (err) {
      restorePending(id, patch, err);
      throw err;
    }
  }

  /** Saves many waiting lines as spends in one batch (more than 450 take several). */
  async function acceptLines(ids: string[]) {
    const lines = ids.map(find);
    for (const line of lines) {
      const reason = cannotSave(line);
      if (reason) throw new NotReadyError(line, reason);
    }
    const writes = lines.map((line) => ({ id: line.id, patch: takePending(line.id), line }));
    bumpPending();
    const chunks = inChunks(writes);
    for (let i = 0; i < chunks.length; i++) {
      const batch = writeBatch(db);
      for (const w of chunks[i]) {
        batch.update(doc(transactionsRef, w.id), {
          ...editPayload(w.patch ?? {}),
          ...trimmed(w.line),
          status: "confirmed",
        });
      }
      try {
        await batch.commit();
      } catch (err) {
        // This chunk and the ones after it weren't saved: their typing stays.
        for (const w of chunks.slice(i).flat()) restorePending(w.id, w.patch, err);
        throw err;
      }
    }
  }

  /** Deletes a waiting line. Adding the same screenshot again brings it back. */
  async function throwAway(id: string) {
    if (find(id).status !== "pending_review") {
      throw new Error(`Transaction ${id} is a saved spend; delete it instead`);
    }
    takePending(id);
    bumpPending();
    await deleteDoc(doc(transactionsRef, id));
  }

  /**
   * "Keep it" (a repeat) and "It's a spend" (incoming money or an own
   * transfer): the line stops needing a look and counts as money going out.
   */
  async function keepLine(id: string) {
    await updateDoc(doc(transactionsRef, id), { kept: true, direction: "out" });
  }

  /** Adds a typed-in spend. */
  async function addSpend(fields: SpendFields) {
    checkSpend(fields);
    const ref = await addDoc(transactionsRef, {
      ...fields,
      source: "manual",
      status: "confirmed",
      createdAt: new Date().toISOString(),
    });
    return ref.id;
  }

  /** Changes a saved spend. Checked like a new one, and touching the category ends its suggestion. */
  async function updateSpend(id: string, fields: SpendFields) {
    checkSpend(fields);
    await writeEdit(id, fields);
  }

  /** Deletes a saved spend for good. */
  async function deleteTransaction(id: string) {
    takePending(id);
    await deleteDoc(doc(transactionsRef, id));
  }

  return {
    transactions,
    spends,
    waiting,
    loading,
    error,
    saveError,
    addScreenshotLines,
    editWaitingLine,
    flushEdits,
    acceptLine,
    acceptLines,
    throwAway,
    keepLine,
    addSpend,
    updateSpend,
    deleteTransaction,
  };
}
