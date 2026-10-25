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
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { inChunks } from "@/lib/batches";
import { suggestCategoryId } from "@/lib/suggest";
import { Category, OcrLine, Transaction } from "@/types";

const transactionsRef = collection(db, "transactions");

/** How long a waiting line's edits wait for more typing before they are written. */
export const EDIT_DELAY_MS = 400;

/** The fields the spend form edits. */
export type SpendFields = Pick<
  Transaction,
  "amount" | "store" | "description" | "categoryId" | "date"
>;

/** Reads a stored document, old shapes included. */
export function toTransaction(id: string, data: DocumentData): Transaction {
  return {
    ...data,
    id,
    amount: typeof data.amount === "number" ? data.amount : null,
    store: data.store ?? "",
    description: data.description ?? "",
    categoryId: data.categoryId ?? "",
    date: data.date ?? "",
    source: data.source === "ocr" ? "ocr" : "manual",
    status: data.status === "pending_review" ? "pending_review" : "confirmed",
    createdAt: data.createdAt ?? "",
  };
}

/** Waiting lines keep the order they arrived in: screenshot by screenshot, then the bank's order. */
export function byArrival(a: Transaction, b: Transaction) {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return (a.seq ?? 0) - (b.seq ?? 0);
}

/** Why a line can't be saved as a spend yet, or null when it can. */
export function cannotSave(line: Transaction): string | null {
  if (line.amount === null || !(line.amount > 0)) return "no amount";
  if (!line.categoryId) return "no category";
  if (!line.store.trim()) return "no store";
  if (!line.date) return "no date";
  if (line.status === "pending_review" && !line.kept) {
    if (line.ownTransfer) return "own transfer";
    if (line.direction === "in") return "incoming";
  }
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

async function writeEdit(id: string, patch: Partial<SpendFields>) {
  await updateDoc(doc(transactionsRef, id), editPayload(patch));
}

export function useTransactions() {
  const [stored, setStored] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edits to waiting lines, kept here until they are written. They show in
  // the lists straight away; the write waits for a pause in typing.
  const pending = useRef(new Map<string, Partial<SpendFields>>());
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

  const transactions = pending.current.size
    ? stored.map((t) => {
        const patch = pending.current.get(t.id);
        if (!patch) return t;
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

  /** Adds the lines read from one screenshot as waiting lines, in the screenshot's order. */
  async function addScreenshotLines(lines: OcrLine[], categories: Category[]) {
    const createdAt = new Date().toISOString();
    const categoryIds = new Set(categories.map((c) => c.id));
    const docs = lines.map((line, seq) => {
      const suggested = suggestCategoryId(line.store, spends, categoryIds);
      return {
        amount: line.amount,
        store: line.store,
        description: line.description,
        categoryId: suggested ?? "",
        date: line.date,
        source: "ocr",
        status: "pending_review",
        createdAt,
        seq,
        direction: line.direction,
        bankLine: { store: line.store, date: line.date, amountText: line.amountText },
        ...(suggested ? { categorySuggested: true } : {}),
        ...(line.ownTransfer ? { ownTransfer: true } : {}),
      };
    });
    for (const chunk of inChunks(docs)) {
      const batch = writeBatch(db);
      for (const data of chunk) batch.set(doc(transactionsRef), data);
      await batch.commit();
    }
  }

  /** Changes a waiting line as the owner types; written after a short pause. */
  function editWaitingLine(id: string, patch: Partial<SpendFields>) {
    pending.current.set(id, { ...pending.current.get(id), ...patch });
    const old = timers.current.get(id);
    if (old) clearTimeout(old);
    timers.current.set(
      id,
      setTimeout(() => {
        flushEdits(id).catch((err) => {
          console.error("saving an edit failed:", err);
          setError(err.message);
        });
      }, EDIT_DELAY_MS)
    );
    bumpPending();
  }

  /** Writes waiting-line edits now: one line's, or every line's. */
  async function flushEdits(id?: string) {
    const ids = id ? [id] : [...pending.current.keys()];
    const writes = ids.flatMap((lineId) => {
      const patch = takePending(lineId);
      return patch ? [writeEdit(lineId, patch)] : [];
    });
    if (writes.length) bumpPending();
    await Promise.all(writes);
  }

  /** Saves one waiting line as a spend, with any edits not yet written. */
  async function acceptLine(id: string) {
    const line = find(id);
    const reason = cannotSave(line);
    if (reason) throw new NotReadyError(line, reason);
    const patch = takePending(id) ?? {};
    bumpPending();
    await updateDoc(doc(transactionsRef, id), {
      ...editPayload(patch),
      status: "confirmed",
    });
  }

  /** Saves many waiting lines as spends in one batch (more than 450 take several). */
  async function acceptLines(ids: string[]) {
    const lines = ids.map(find);
    for (const line of lines) {
      const reason = cannotSave(line);
      if (reason) throw new NotReadyError(line, reason);
    }
    const writes = lines.map((line) => ({
      id: line.id,
      data: { ...editPayload(takePending(line.id) ?? {}), status: "confirmed" },
    }));
    bumpPending();
    for (const chunk of inChunks(writes)) {
      const batch = writeBatch(db);
      for (const w of chunk) batch.update(doc(transactionsRef, w.id), w.data);
      await batch.commit();
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

  async function addTransaction(input: Omit<Transaction, "id" | "createdAt">) {
    await addDoc(transactionsRef, { ...input, createdAt: new Date().toISOString() });
  }

  /** Changes a saved spend. */
  async function updateTransaction(id: string, input: Partial<Omit<Transaction, "id">>) {
    await updateDoc(doc(transactionsRef, id), input);
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
    addScreenshotLines,
    editWaitingLine,
    flushEdits,
    acceptLine,
    acceptLines,
    throwAway,
    keepLine,
    addSpend,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
