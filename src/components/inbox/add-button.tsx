"use client";

import type { Ref } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/icon";
import { useWriteGuard } from "@/components/ui/use-write-guard";
import styles from "./home.module.css";

type Props = {
  /** Opens the file picker. */
  onPress: () => void;
  /** Screenshots are being read: the same ones must not go out twice. */
  reading: boolean;
  /** "Add" on a phone and "Add screenshots" wide (the one beside the title), or always the full words. */
  short?: boolean;
  big?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

/** The button that brings in screenshots. Off while reading, and with no connection (it says why when pressed). */
export function AddButton({ onPress, reading, short, big, ref }: Props) {
  const { blocked, refuse } = useWriteGuard(true);
  return (
    <button
      ref={ref}
      type="button"
      className={cx(styles.add, big && styles.addBig, blocked && !reading && styles.addOffline)}
      aria-label="Add screenshots"
      aria-disabled={reading || undefined}
      onClick={() => {
        if (reading) return;
        if (blocked) refuse();
        else onPress();
      }}
    >
      <Icon name="plus" />
      {short ? (
        <span>
          Add<span className={styles.long}> screenshots</span>
        </span>
      ) : (
        <span>Add screenshots</span>
      )}
    </button>
  );
}
