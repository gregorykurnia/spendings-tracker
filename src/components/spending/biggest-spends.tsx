"use client";

import { useId } from "react";
import { cx } from "@/components/ui/cx";
import { CategoryDisc } from "@/components/ui/pill";
import { formatDay } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import type { Category, Transaction } from "@/types";
import styles from "./spending.module.css";
import { categoryLook } from "./spending";

type Props = {
  spends: readonly Transaction[];
  categories: readonly Category[];
  today: string;
  /** A spend was pressed: it opens in the Change spend form (U8). */
  onOpen: (spend: Transaction) => void;
};

/** The biggest spends of the period: store, then date and category, and the amount. */
export function BiggestSpends({ spends, categories, today, onOpen }: Props) {
  const headingId = useId();
  return (
    <section className={cx(styles.sec, styles.big)} aria-labelledby={headingId}>
      <h2 id={headingId}>Biggest spends</h2>
      <ul className={styles.list}>
        {spends.map((spend) => {
          const look = categoryLook(spend.categoryId, categories);
          return (
            <li key={spend.id}>
              <button type="button" className={styles.txLine} onClick={() => onOpen(spend)}>
                <CategoryDisc emoji={look.emoji} color={look.color} />
                <span className={styles.txMain}>
                  <span className={styles.txStore}>{spend.store}</span>
                  <span className={styles.txSub}>{`${formatDay(spend.date, today)} · ${look.name}`}</span>
                </span>
                <span className={styles.txSide}>
                  <b>{formatRupiah(spend.amount)}</b>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
