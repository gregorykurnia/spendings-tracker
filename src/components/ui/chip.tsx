"use client";

import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import styles from "./chip.module.css";
import { cx } from "./cx";
import { useWriteGuard } from "./use-write-guard";

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> & {
  /** A choice that is on: petrol, and `aria-pressed`. Leave it out for a chip that isn't a toggle. */
  on?: boolean;
  /** The dashed "More" chip that opens the full list. */
  more?: boolean;
  /** The fourth quick choice: under 520 wide it hides unless it is on. */
  fourth?: boolean;
  disabled?: boolean;
  /** This chip changes data: offline it is dimmed and says why when pressed. */
  writes?: boolean;
  /** An emoji before the name. */
  emoji?: string;
  children: ReactNode;
};

export function Chip({
  on,
  more,
  fourth,
  disabled,
  writes,
  emoji,
  className,
  type = "button",
  onClick,
  children,
  ...rest
}: ChipProps) {
  const { blocked, refuse } = useWriteGuard(writes);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (disabled) {
      event.preventDefault();
      return;
    }
    if (blocked) {
      event.preventDefault();
      refuse();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      type={type}
      className={cx(
        styles.chip,
        on && styles.on,
        more && styles.more,
        fourth && !on && styles.fourth,
        blocked && styles.offline,
        className
      )}
      aria-pressed={on === undefined ? undefined : on}
      aria-disabled={disabled || undefined}
      onClick={handleClick}
    >
      {emoji ? <i aria-hidden="true">{emoji}</i> : null}
      {children}
    </button>
  );
}

/** A row of chips that wraps. `label` names the group for screen readers. */
export function Chips({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {children}
    </div>
  );
}
