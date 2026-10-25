"use client";

import { Spinner } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { FieldError } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useWriteGuard } from "@/components/ui/use-write-guard";
import styles from "./inbox.module.css";
import { acceptBarLabel } from "./rules";

type Props = {
  /** How many lines are in "Look right". */
  ready: number;
  /** How many need a look (they are never accepted from here). */
  needLook: number;
  /** How many are being accepted now, or null. */
  accepting: number | null;
  /** Why the last try failed. */
  error?: string;
  onAccept: () => void;
};

/** "Accept the 5 that look right": fixed to the bottom on a phone, sticky when wide. */
export function AcceptBar({ ready, needLook, accepting, error, onAccept }: Props) {
  const { blocked, refuse } = useWriteGuard(true);
  const busy = accepting !== null;
  return (
    <div className={styles.bar}>
      {error ? <FieldError net>{error}</FieldError> : null}
      <button
        type="button"
        className={cx(styles.acceptAll, blocked && !busy && styles.offline)}
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        onClick={() => {
          if (busy) return;
          if (blocked) refuse();
          else onAccept();
        }}
      >
        {busy ? <Spinner /> : <Icon name="check" />}
        {acceptBarLabel({ ready, needLook, accepting })}
      </button>
    </div>
  );
}
