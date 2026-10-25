"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip, Chips } from "@/components/ui/chip";
import { AmountField, DateField, FieldError, FieldSummary, Hint, TextField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetBody, SheetButtons, SheetFoot, SheetHead } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import type { SpendFields, useTransactions } from "@/hooks/useTransactions";
import { useOnline } from "@/hooks/useOnline";
import { todayISO } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { NET_ERROR } from "@/lib/offline";
import type { Category } from "@/types";
import { BankCrop } from "./bank-crop";
import { CategoryPicker } from "./category-picker";
import { DeleteSpendDialog } from "./delete-spend-dialog";
import {
  amountInputText,
  formWords,
  missingFields,
  needsDecision,
  notSavedMessage,
  parseAmountInput,
  problems,
  quickCategories,
  summaryLine,
  type Draft,
  type FieldKey,
  type SpendFormMode,
} from "./rules";
import styles from "./spend-form.module.css";

/** The hook functions the form calls; a screen passes them from its own `useTransactions()`. */
export type SpendFormActions = Pick<
  ReturnType<typeof useTransactions>,
  "addSpend" | "updateSpend" | "editWaitingLine" | "flushEdits" | "acceptLine" | "deleteTransaction"
>;

type Props = {
  mode: SpendFormMode;
  categories: readonly Category[];
  actions: SpendFormActions;
  /** Closed without a change, saved, accepted or deleted. */
  onClose: () => void;
};

function startingDraft(mode: SpendFormMode): Draft {
  if (mode.kind === "correct" || mode.kind === "change") {
    const t = mode.kind === "correct" ? mode.line : mode.spend;
    return {
      store: t.store,
      amount: t.amount,
      date: t.date,
      categoryId: t.categoryId,
      note: t.description,
    };
  }
  return { store: "", amount: null, date: todayISO(), categoryId: "", note: "" };
}

/**
 * The one form for typing in a spend, correcting a waiting line and changing a saved spend. A
 * waiting line is edited in place and kept as it is typed (design notes §7); the other two are
 * saved with the main button. Render it only while it is open.
 */
export function SpendForm({ mode, categories, actions, onClose }: Props) {
  const online = useOnline();
  const { toast, announce } = useToast();
  const correcting = mode.kind === "correct";
  const words = formWords(mode.kind);
  const categoryIds = new Set(categories.map((c) => c.id));

  // A waiting line is the live one from the hook; the other two keep their own draft.
  const [typed, setTyped] = useState<Draft>(() => startingDraft(mode));
  const draft: Draft = mode.kind === "correct" ? startingDraft(mode) : typed;
  // A line that came in with no amount says to check the screenshot. Decided once, when it opens.
  const [unread] = useState(() => mode.kind === "correct" && mode.line.amount == null);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>(() =>
    // A saved spend whose category was removed says so from the start.
    mode.kind === "change" && mode.spend.categoryId && !categoryIds.has(mode.spend.categoryId)
      ? { category: true }
      : {}
  );
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const body = useRef<HTMLDivElement>(null);

  const found = problems(draft, categoryIds, unread);
  const keys = missingFields(found);
  const decide = mode.kind === "correct" && needsDecision(mode.line);
  // A field's message shows after leaving the field or after a try.
  const errorFor = (key: FieldKey) => (attempted || touched[key] ? found[key] : undefined);
  // A waiting line writes as it is typed, so with no connection it can't be typed in.
  const locked = busy || (correcting && !online);

  function set(patch: Partial<Draft>) {
    if (mode.kind === "correct") {
      const { note, ...rest } = patch;
      actions.editWaitingLine(mode.line.id, note === undefined ? rest : { ...rest, description: note });
    } else {
      setTyped((d) => ({ ...d, ...patch }));
    }
  }

  function touch(key: FieldKey) {
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  }

  function focusField(key: FieldKey) {
    const root = body.current;
    const target =
      key === "category"
        ? root?.querySelector<HTMLElement>('[role="group"] button')
        : root?.querySelector<HTMLElement>(`[name="${key}"]`);
    target?.focus();
  }

  async function submit() {
    if (busy) return;
    if (keys.length) {
      setAttempted(true);
      focusField(keys[0]);
      announce(notSavedMessage(keys));
      return;
    }
    if (decide) return;
    if (!online) {
      setError(NET_ERROR);
      announce(NET_ERROR);
      return;
    }
    setError("");
    setBusy(true);
    const store = draft.store.trim();
    const fields: SpendFields = {
      store,
      amount: draft.amount,
      date: draft.date,
      categoryId: draft.categoryId,
      description: draft.note.trim(),
    };
    try {
      if (mode.kind === "add") await actions.addSpend(fields);
      else if (mode.kind === "change") await actions.updateSpend(mode.spend.id, fields);
      else await actions.acceptLine(mode.line.id);
    } catch (err) {
      console.error("saving a spend failed:", err);
      setBusy(false);
      setError(navigator.onLine ? "Couldn't save this. Try again in a moment." : NET_ERROR);
      return;
    }
    const done =
      mode.kind === "change" ? "Saved changes." : `${mode.kind === "add" ? "Added" : "Accepted"} ${store}, ${formatRupiah(draft.amount)}.`;
    toast(done);
    announce(done);
    onClose();
  }

  async function done() {
    // Closing never loses typing: write what is waiting now rather than after the pause.
    if (mode.kind === "correct") await actions.flushEdits(mode.line.id).catch(() => {});
    onClose();
  }

  const quick = quickCategories(categories, draft.categoryId);
  const suggested = mode.kind === "correct" && mode.line.categorySuggested && !touched.category;
  const focus = mode.kind === "add" ? "store" : mode.kind === "correct" ? mode.focus : undefined;
  const source = mode.kind === "change" ? mode.spend.source : null;
  const summary = decide
    ? "Decide about this one first: throw it away, or say it's a spend."
    : summaryLine(keys);

  return (
    <>
      <Sheet label={words.title} onClose={mode.kind === "correct" ? done : onClose} busy={busy}>
        <SheetHead title={words.title} />
        <SheetBody>
          <div ref={body} className={styles.fields}>
            {mode.kind === "correct" ? (
              <>
                <p className={styles.note}>Changes are kept as you go.</p>
                <BankCrop line={mode.line} />
              </>
            ) : null}
            {source ? (
              <p className={styles.note}>
                <Icon name={source === "manual" ? "pencil" : "image"} size={18} />
                {source === "manual" ? "Typed in by hand" : "Added from a screenshot"}
              </p>
            ) : null}

            <TextField
              label="Store"
              name="store"
              value={draft.store}
              maxLength={80}
              readOnly={locked}
              error={errorFor("store")}
              data-autofocus={focus === "store" ? "" : undefined}
              onChange={(e) => set({ store: e.target.value })}
              onBlur={() => touch("store")}
            />
            <div className={styles.two}>
              <AmountField
                label="Amount"
                name="amount"
                value={amountInputText(draft.amount)}
                placeholder="0"
                readOnly={locked}
                error={errorFor("amount")}
                data-autofocus={focus === "amount" ? "" : undefined}
                onChange={(e) => set({ amount: parseAmountInput(e.target.value) })}
                onBlur={() => touch("amount")}
              />
              <DateField
                label="Date"
                name="date"
                value={draft.date}
                readOnly={locked}
                error={errorFor("date")}
                autoFocusField={focus === "date"}
                onChange={(date) => {
                  set({ date });
                  touch("date");
                }}
                onBlur={() => touch("date")}
              />
            </div>

            <div className={styles.group}>
              <span className={styles.groupLabel}>Category</span>
              {suggested ? <Hint>Suggested from the store name</Hint> : null}
              <Chips label="Category">
                {quick.map((category, i) => (
                  <Chip
                    key={category.id}
                    emoji={category.emoji}
                    on={category.id === draft.categoryId}
                    fourth={i === 3}
                    writes={correcting}
                    disabled={busy}
                    onClick={() => {
                      set({ categoryId: category.id });
                      touch("category");
                    }}
                  >
                    {category.name}
                  </Chip>
                ))}
                <Chip more writes={correcting} disabled={busy} onClick={() => setPicking(true)}>
                  More
                  <Icon name="down" size={18} />
                </Chip>
              </Chips>
              {errorFor("category") ? <FieldError>{found.category}</FieldError> : null}
            </div>

            <TextField
              label={
                <>
                  Note <span className={styles.optional}>(optional)</span>
                </>
              }
              name="note"
              value={draft.note}
              placeholder="What did you buy?"
              maxLength={120}
              readOnly={locked}
              onChange={(e) => set({ note: e.target.value })}
            />

            {mode.kind === "change" && !busy ? (
              <div className={styles.deleteZone}>
                <Button variant="dangerOutline" onClick={() => setDeleting(true)}>
                  <Icon name="trash" />
                  Delete this spend
                </Button>
              </div>
            ) : null}
          </div>
        </SheetBody>
        <SheetFoot>
          {error ? <FieldError net>{error}</FieldError> : null}
          {!error && correcting && !online ? <FieldError net>{NET_ERROR}</FieldError> : null}
          {summary ? <FieldSummary>{summary}</FieldSummary> : null}
          <SheetButtons>
            <Button size="big" disabled={busy} onClick={mode.kind === "correct" ? done : onClose}>
              {words.secondary}
            </Button>
            <Button
              size="big"
              variant="solid"
              notReady={keys.length > 0 || decide}
              busy={busy}
              busyLabel={words.busy}
              onClick={submit}
            >
              {words.primary}
            </Button>
          </SheetButtons>
        </SheetFoot>
      </Sheet>

      {picking ? (
        <CategoryPicker
          categories={categories}
          selectedId={draft.categoryId}
          onChoose={(categoryId) => {
            set({ categoryId });
            touch("category");
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}

      {deleting && mode.kind === "change" ? (
        <DeleteSpendDialog
          spend={mode.spend}
          category={categories.find((c) => c.id === mode.spend.categoryId)}
          deleteTransaction={actions.deleteTransaction}
          onCancel={() => setDeleting(false)}
          onDeleted={onClose}
        />
      ) : null}
    </>
  );
}
