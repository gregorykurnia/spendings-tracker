"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FieldError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { CategoryPicker } from "@/components/spend-form/category-picker";
import type { SpendFields, useTransactions } from "@/hooks/useTransactions";
import { useOnline } from "@/hooks/useOnline";
import { todayISO } from "@/lib/dates";
import { reviewReasons, type ReviewAction } from "@/lib/review";
import type { Category, Transaction } from "@/types";
import { AcceptBar } from "./accept-bar";
import styles from "./inbox.module.css";
import { LookRow } from "./look-row";
import { ReviewRow } from "./review-row";
import {
  acceptedManyMessage,
  acceptedOneMessage,
  inboxGroups,
  inboxSub,
  inboxTitle,
  jumpLabel,
  keptMessage,
  nextFocusId,
  showAcceptBar,
  thrownAwayMessage,
  type Departing,
  type GroupName,
  type InboxItem,
} from "./rules";

/** The hook functions the inbox calls; a screen passes them from its own `useTransactions()`. */
export type InboxActions = Pick<
  ReturnType<typeof useTransactions>,
  "editWaitingLine" | "acceptLine" | "acceptLines" | "throwAway" | "keepLine"
>;

/** How long a leaving row takes to collapse (`--dur-leave`). */
export const LEAVE_MS = 210;

const SAVE_FAILED = "Couldn't save your last change. Try again in a moment.";

type Props = {
  waiting: readonly Transaction[];
  spends: readonly Transaction[];
  /** Every category, in the owner's order. */
  categories: readonly Category[];
  actions: InboxActions;
  /** The hook's `saveError`: a typed edit that couldn't be written. It is shown beside the line, not instead of the screen. */
  saveError: string | null;
  /** The line the last edit was made on, so `saveError` can be shown beside it. */
  editedId: string | null;
  /** "Edit details", or a fix that needs the form: opens it on that line. */
  onCorrect: (line: Transaction, focus?: "store" | "amount" | "date") => void;
  /** The "Add" button beside the title. */
  headAction?: ReactNode;
  /** The import tray, while there is one (it takes the place of the news when nothing is waiting). */
  tray?: ReactNode;
  /** Nothing has ever been added: the title and the panel say how to begin. */
  firstUse?: boolean;
  /** Every waiting line came in this visit, from this many screenshots: the line under the title says so. */
  freshShots?: number;
  /** Shown instead of the lists when nothing is waiting and no tray is up. */
  emptyPanel?: ReactNode;
};

/**
 * The inbox: how many lines are waiting, "Look right" with a tick on each, "Need a look" with a reason
 * and two buttons on each, and the bar that accepts everything that looks right. Lines keep the order
 * they arrived in, and a line that leaves never moves the ones below it before it has gone.
 */
export function Inbox({
  waiting,
  spends,
  categories,
  actions,
  saveError,
  editedId,
  onCorrect,
  headAction,
  tray,
  firstUse = false,
  freshShots,
  emptyPanel,
}: Props) {
  const online = useOnline();
  const { toast, announce } = useToast();
  // This only renders once the data has loaded in the browser, so there is no server-rendered "today".
  const today = todayISO();
  const categoryIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  // Lines on their way out (see `Departing`).
  const [departing, setDeparting] = useState<ReadonlyMap<string, Departing>>(() => new Map());
  // How many "Accept the N that look right" is taking, while it works.
  const [bulk, setBulk] = useState<number | null>(null);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [bulkError, setBulkError] = useState("");
  // Focus goes to this line's main control after the next render; `null` is the page's main area.
  const [focusAfter, setFocusAfter] = useState<{ id: string | null } | null>(null);

  const root = useRef<HTMLElement>(null);
  const lookHeading = useRef<HTMLHeadingElement>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const order = useRef<string[]>([]);

  const groups = inboxGroups(waiting, spends, categoryIds, departing);
  const ready = groups.lookRight.filter((item) => !departing.has(item.line.id));
  const shownOrder = [...groups.lookRight, ...groups.needLook].map((item) => item.line.id);

  useEffect(() => {
    order.current = shownOrder.slice();
  });

  useEffect(() => {
    const waits = timers.current;
    return () => waits.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!focusAfter) return;
    const target = focusAfter.id
      ? root.current?.querySelector<HTMLElement>(`[data-focus-id="${focusAfter.id}"]`)
      : null;
    (target ?? document.getElementById("main"))?.focus();
  }, [focusAfter]);

  /* ---------- lines on their way out ---------- */

  function groupOf(id: string): GroupName | null {
    if (groups.lookRight.some((item) => item.line.id === id)) return "lookRight";
    if (groups.needLook.some((item) => item.line.id === id)) return "needLook";
    return null;
  }

  function setPhase(items: readonly InboxItem[], phase: Departing["phase"]) {
    setDeparting((current) => {
      const next = new Map(current);
      for (const item of items) {
        const before = current.get(item.line.id);
        const group = before?.group ?? groupOf(item.line.id);
        if (group) next.set(item.line.id, { ...item, group, phase });
      }
      return next;
    });
  }

  function drop(ids: readonly string[]) {
    setDeparting((current) => {
      if (!ids.some((id) => current.has(id))) return current;
      const next = new Map(current);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  /** The rows collapse; once gone, focus moves to the next line and `done` runs. */
  function leave(items: readonly InboxItem[], done?: () => void) {
    const ids = items.map((item) => item.line.id);
    const gone = new Set(ids);
    const neighbour = nextFocusId(order.current, gone);
    setPhase(items, "leaving");
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      drop(ids);
      setOpenId((id) => (id !== null && gone.has(id) ? null : id));
      setFocusAfter({ id: neighbour });
      done?.();
    }, LEAVE_MS);
    timers.current.add(timer);
  }

  function setError(id: string, message: string) {
    setErrors((current) => ({ ...current, [id]: message }));
  }

  function clearError(id: string) {
    setErrors((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  /* ---------- what the buttons do ---------- */

  function edit(line: Transaction, patch: Partial<SpendFields>) {
    actions.editWaitingLine(line.id, patch);
  }

  async function acceptOne(item: InboxItem) {
    const { line } = item;
    clearError(line.id);
    setBulkError("");
    setPhase([item], "accepting");
    try {
      await actions.acceptLine(line.id);
    } catch (err) {
      console.error("accepting a line failed:", err);
      drop([line.id]);
      setError(line.id, "Couldn't accept this one. Try again in a moment.");
      return;
    }
    announce(acceptedOneMessage(line, waiting.length - 1));
    leave([item]);
  }

  async function acceptAll() {
    const items = ready;
    if (!showAcceptBar(items.length)) return;
    setBulkError("");
    setBulk(items.length);
    setPhase(items, "accepting");
    try {
      await actions.acceptLines(items.map((item) => item.line.id));
    } catch (err) {
      console.error("accepting the lines failed:", err);
      drop(items.map((item) => item.line.id));
      setBulk(null);
      setBulkError("Couldn't accept them. Try again in a moment.");
      return;
    }
    const message = acceptedManyMessage(items.map((item) => item.line));
    leave(items, () => {
      setBulk(null);
      toast(message);
      announce(`${message} ${waiting.length - items.length} left to check.`);
    });
  }

  async function throwOne(item: InboxItem) {
    const { line } = item;
    clearError(line.id);
    setBulkError("");
    // It leaves at once; if the write fails the line comes back with a message beside it.
    leave([item]);
    try {
      await actions.throwAway(line.id);
    } catch (err) {
      console.error("throwing a line away failed:", err);
      drop([line.id]);
      setError(line.id, "Couldn't throw this one away. Try again in a moment.");
      return;
    }
    announce(thrownAwayMessage(line, waiting.length - 1));
  }

  async function keepOne(item: InboxItem) {
    const { line } = item;
    clearError(line.id);
    try {
      await actions.keepLine(line.id);
    } catch (err) {
      console.error("keeping a line failed:", err);
      setError(line.id, "Couldn't keep this one. Try again in a moment.");
      return;
    }
    const kept = { ...line, kept: true, direction: "out" as const };
    announce(keptMessage(reviewReasons(kept, spends, categoryIds).length > 0));
    // The row has moved on (maybe to "Look right"): focus follows it.
    setFocusAfter({ id: line.id });
  }

  function lookAction(item: InboxItem, action: ReviewAction) {
    switch (action.action) {
      case "throw":
        return void throwOne(item);
      case "keep":
        return void keepOne(item);
      case "pick-category":
        return setPicking(item.line.id);
      case "fix":
        return onCorrect(item.line, action.field);
    }
  }

  function jump() {
    const heading = lookHeading.current;
    if (!heading) return;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    heading.focus({ preventScroll: true });
  }

  /* ---------- what is shown ---------- */

  // A typed edit that couldn't be written belongs to the line being edited; if that line is gone it
  // is said above the lists instead.
  const saveErrorLine = saveError && editedId && shownOrder.includes(editedId) ? editedId : null;
  const messageFor = (id: string) => errors[id] ?? (saveErrorLine === id ? SAVE_FAILED : undefined);
  const lonelySaveError = saveError && !saveErrorLine;

  const needLook = groups.needLook.filter((item) => !departing.has(item.line.id)).length;
  const pickingLine = picking ? waiting.find((line) => line.id === picking) : undefined;
  const barShown = bulk !== null || showAcceptBar(ready.length);
  // The count drops when a row leaves, not when its write starts: a line being accepted is still waiting.
  const counted = [...groups.lookRight, ...groups.needLook]
    .filter((item) => departing.get(item.line.id)?.phase !== "leaving")
    .map((item) => item.line);
  const context = { tray: Boolean(tray), firstUse, freshShots };
  const sub = inboxSub(counted, today, context);
  const nothingShown = !groups.lookRight.length && !groups.needLook.length && !tray;

  return (
    <section ref={root} className={barShown ? `${styles.inbox} ${styles.withBar}` : styles.inbox} aria-labelledby="inbox-title">
      <div className={styles.head}>
        <div>
          <h1 id="inbox-title">{inboxTitle(counted.length, context)}</h1>
          {sub ? <p>{sub}</p> : null}
          {lonelySaveError ? <FieldError net>{SAVE_FAILED}</FieldError> : null}
        </div>
        {headAction}
      </div>

      {tray}

      {nothingShown ? emptyPanel : null}

      {groups.lookRight.length ? (
        <section className={styles.grp} aria-labelledby="inbox-right">
          <div className={styles.grpHead}>
            <h2 id="inbox-right" tabIndex={-1}>
              Look right <span>{groups.lookRight.length}</span>
            </h2>
            {needLook ? (
              <button type="button" className={styles.jump} onClick={jump}>
                <i className={styles.dot} />
                {jumpLabel(needLook)}
              </button>
            ) : null}
          </div>
          <ul className={styles.rows}>
            {groups.lookRight.map((item) => {
              const { line } = item;
              const category = categoryById.get(line.categoryId);
              const phase = departing.get(line.id)?.phase;
              if (!category) return null;
              return (
                <ReviewRow
                  key={line.id}
                  line={line}
                  category={category}
                  categories={categories}
                  today={today}
                  open={openId === line.id}
                  busy={phase === "accepting"}
                  leaving={phase === "leaving"}
                  readOnly={!online}
                  error={messageFor(line.id)}
                  onToggle={() => setOpenId(openId === line.id ? null : line.id)}
                  onAccept={() => void acceptOne(item)}
                  onNote={(description) => edit(line, { description })}
                  onCategory={(categoryId) => edit(line, { categoryId })}
                  onMore={() => setPicking(line.id)}
                  onEdit={() => onCorrect(line)}
                  onThrow={() => void throwOne(item)}
                />
              );
            })}
          </ul>
        </section>
      ) : null}

      {groups.needLook.length ? (
        <section className={`${styles.grp} ${styles.look}`} aria-labelledby="inbox-look">
          <h2 id="inbox-look" tabIndex={-1} ref={lookHeading}>
            Need a look <span>{groups.needLook.length}</span>
          </h2>
          <ul className={styles.rows}>
            {groups.needLook.map((item) => (
              <LookRow
                key={item.line.id}
                line={item.line}
                reasons={item.reasons}
                today={today}
                leaving={departing.get(item.line.id)?.phase === "leaving"}
                error={messageFor(item.line.id)}
                onAction={(action) => lookAction(item, action)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {barShown ? (
        <AcceptBar
          ready={ready.length}
          needLook={needLook}
          accepting={bulk}
          error={bulkError}
          onAccept={() => void acceptAll()}
        />
      ) : null}

      {pickingLine ? (
        <CategoryPicker
          categories={categories}
          selectedId={pickingLine.categoryId}
          onChoose={(categoryId) => {
            edit(pickingLine, { categoryId });
            setFocusAfter({ id: pickingLine.id });
          }}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </section>
  );
}
