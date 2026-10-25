import type { MouseEvent } from "react";
import { Icon } from "./icon";
import styles from "./step-button.module.css";

type Props = {
  direction: "left" | "right";
  /** What a screen reader hears: "Earlier month", "Previous day". */
  label: string;
  /** At the first or last stop. It stays in the tab order, and pressing it does nothing. */
  disabled?: boolean;
  onPress: () => void;
};

/** A round 44 button with an arrow: earlier and later, previous and next. */
export function StepButton({ direction, label, disabled, onPress }: Props) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onPress();
  }
  return (
    <button
      type="button"
      className={styles.step}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={handleClick}
    >
      <Icon name={direction} />
    </button>
  );
}
