"use client";

import { useId } from "react";
import { cx } from "@/components/ui/cx";
import { Spinner } from "@/components/ui/button";
import { Chip, Chips } from "@/components/ui/chip";
import { FieldError, Hint, TextField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Pill } from "@/components/ui/pill";
import { useWriteGuard } from "@/components/ui/use-write-guard";
import { BankCrop } from "@/components/spend-form/bank-crop";
import { quickCategories } from "@/components/spend-form/rules";
import { formatDay } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import type { Category, Transaction } from "@/types";
import styles from "./inbox.module.css";
import { tickLabel } from "./rules";

/** The round tick that accepts one line. Offline it is dimmed and says why when pressed. */
function Tick({ line, busy, onAccept }: { line: Transaction; busy: boolean; onAccept: () => void }) {
  const { blocked, refuse } = useWriteGuard(true);
  if (busy) {
    return (
      <span className={cx(styles.tick, styles.tickBusy)} role="img" aria-label={`Accepting ${line.store}`}>
        <Spinner />
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cx(styles.tick, blocked && styles.offline)}
      data-focus-id={line.id}
      aria-label={tickLabel(line)}
      aria-disabled={blocked || undefined}
      onClick={() => (blocked ? refuse() : onAccept())}
    >
      <Icon name="check" />
    </button>
  );
}

type Props = {
  line: Transaction;
  /** The line's category; always one that exists, or the line would need a look instead. */
  category: Category;
  categories: readonly Category[];
  today: string;
  open: boolean;
  /** Being accepted: a spinner in place of the tick. */
  busy: boolean;
  leaving: boolean;
  /** No connection: the note can't be typed in. */
  readOnly: boolean;
  /** What went wrong with this line, shown under it. */
  error?: string;
  onToggle: () => void;
  onAccept: () => void;
  onNote: (note: string) => void;
  onCategory: (categoryId: string) => void;
  onMore: () => void;
  onEdit: () => void;
  onThrow: () => void;
};

/** A line in "Look right": a tick, the name that opens it, the category, the amount and the date. */
export function ReviewRow({
  line,
  category,
  categories,
  today,
  open,
  busy,
  leaving,
  readOnly,
  error,
  onToggle,
  onAccept,
  onNote,
  onCategory,
  onMore,
  onEdit,
  onThrow,
}: Props) {
  const panel = useId();
  const { blocked, refuse } = useWriteGuard(true);
  return (
    <li className={cx(styles.row, open && styles.open, busy && styles.busy, leaving && styles.leaving)}>
      <div className={styles.rowIn}>
        <div className={styles.rowHead}>
          <Tick line={line} busy={busy} onAccept={onAccept} />
          <div className={styles.main}>
            <button
              type="button"
              className={cx(styles.store, styles.storeOpen)}
              aria-expanded={open}
              aria-controls={open ? panel : undefined}
              onClick={onToggle}
            >
              {line.store}
            </button>
            <Pill category={category} />
          </div>
          <div className={styles.side}>
            <p className={styles.amt}>{formatRupiah(line.amount)}</p>
            <p className={styles.date}>{formatDay(line.date, today)}</p>
          </div>
        </div>
        {error ? (
          <div className={styles.lineMsg}>
            <FieldError net>{error}</FieldError>
          </div>
        ) : null}
        {open ? (
          <div className={styles.edit} id={panel}>
            <div className={styles.cropSlot}>
              <BankCrop line={line} />
            </div>
            <TextField
              className={styles.note}
              label="What did you buy?"
              name="note"
              value={line.description}
              placeholder="What did you buy? (optional)"
              maxLength={120}
              readOnly={readOnly}
              onChange={(e) => onNote(e.target.value)}
            />
            <div className={styles.catWrap}>
              {line.categorySuggested ? <Hint>Suggested from the store name</Hint> : null}
              <Chips label="Category">
                {quickCategories(categories, line.categoryId).map((c, i) => (
                  <Chip
                    key={c.id}
                    emoji={c.emoji}
                    on={c.id === line.categoryId}
                    fourth={i === 3}
                    writes
                    onClick={() => onCategory(c.id)}
                  >
                    {c.name}
                  </Chip>
                ))}
                <Chip more writes onClick={onMore}>
                  More
                  <Icon name="down" size={18} />
                </Chip>
              </Chips>
            </div>
            <div className={styles.links}>
              <button type="button" onClick={onEdit}>
                Edit details
              </button>
              <button
                type="button"
                className={cx(blocked && styles.offline)}
                onClick={() => (blocked ? refuse() : onThrow())}
              >
                Throw away
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}
