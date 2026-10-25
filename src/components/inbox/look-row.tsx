"use client";

import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { FieldError } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { formatDay } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { REVIEW_REASONS, type ReviewAction, type ReviewReason } from "@/lib/review";
import type { Transaction } from "@/types";
import styles from "./inbox.module.css";

type Props = {
  line: Transaction;
  /** Why it needs a look; the first one is shown. */
  reasons: readonly ReviewReason[];
  today: string;
  leaving: boolean;
  error?: string;
  /** A button was pressed: the fix, "Choose category", "Throw away", or "Keep it" / "It's a spend". */
  onAction: (action: ReviewAction) => void;
};

/** A line that can't be accepted yet: one plain reason, then the fix first and "Throw away" (or the other way round). */
export function LookRow({ line, reasons, today, leaving, error, onAction }: Props) {
  const info = REVIEW_REASONS[reasons[0]];
  const hasAmount = line.amount != null && line.amount > 0;
  return (
    <li className={cx(styles.row, leaving && styles.leaving)}>
      <div className={styles.rowIn}>
        <div className={styles.rowHead}>
          <span className={cx(styles.flag, info.alert && styles.flagAlert)}>
            <Icon name={info.icon} />
          </span>
          <div className={styles.main}>
            <p className={styles.store}>{line.store.trim() ? line.store : "No store name"}</p>
            <p className={styles.why}>{info.why}</p>
          </div>
          <div className={styles.side}>
            {hasAmount ? (
              <p className={styles.amt}>{formatRupiah(line.amount)}</p>
            ) : (
              <p className={styles.amtBad}>
                <Icon name="alert" size={18} />
                No amount
              </p>
            )}
            <p className={styles.date}>{line.date ? formatDay(line.date, today) : "No date"}</p>
          </div>
        </div>
        {error ? (
          <div className={styles.lineMsg}>
            <FieldError net>{error}</FieldError>
          </div>
        ) : null}
        <div className={styles.act}>
          {info.actions.map((action, i) => (
            <Button
              key={action.action}
              variant={action.primary ? "solid" : "outline"}
              // Opening the form changes nothing; the others write.
              writes={action.action !== "fix"}
              data-focus-id={i === 0 ? line.id : undefined}
              onClick={() => onAction(action)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </li>
  );
}
