"use client";

import type { MouseEvent } from "react";
import { Icon } from "./icon";
import styles from "./step-button.module.css";
import { cx } from "./cx";
import { useWriteGuard } from "./use-write-guard";

type Props = {
  /** Left and right for earlier and later; up and down for moving in a list. */
  direction: "left" | "right" | "up" | "down";
  /** What a screen reader hears: "Earlier month", "Previous day". */
  label: string;
  /** At the first or last stop. It stays in the tab order, and pressing it does nothing. */
  disabled?: boolean;
  /** Pressing it changes data: offline it is dimmed and says why when pressed. */
  writes?: boolean;
  /** Lets a screen find the button again, to put focus back after a move. */
  dataStep?: string;
  onPress: () => void;
};

/** A round 44 button with an arrow: earlier and later, previous and next, up and down. */
export function StepButton({ direction, label, disabled, writes, dataStep, onPress }: Props) {
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
    onPress();
  }
  return (
    <button
      type="button"
      className={cx(styles.step, blocked && !disabled && styles.offline)}
      aria-label={label}
      aria-disabled={disabled || undefined}
      data-step={dataStep}
      onClick={handleClick}
    >
      <Icon name={direction} />
    </button>
  );
}
