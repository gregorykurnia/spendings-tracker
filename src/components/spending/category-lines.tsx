"use client";

import Link from "next/link";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { CategoryDisc } from "@/components/ui/pill";
import { formatRupiah } from "@/lib/money";
import { shareLabel, type CategoryShare, type Period } from "@/lib/periods";
import { swatchSolid } from "@/lib/swatches";
import type { Category } from "@/types";
import styles from "./spending.module.css";
import { categoryHref, categoryLook } from "./spending";

type Props = {
  shares: readonly CategoryShare[];
  categories: readonly Category[];
  period: Period;
  /** Names the period on the chip All transactions shows: `October so far`. */
  label: string;
  /** How many categories are folded away behind "Show N more". */
  more: number;
  showAll: boolean;
  onToggleAll: () => void;
};

/** Where it went: every category with spending, biggest first. Each opens its spends (U7). */
export function CategoryLines({ shares, categories, period, label, more, showAll, onToggleAll }: Props) {
  const headingId = useId();
  return (
    <section className={cx(styles.sec, styles.cats)} aria-labelledby={headingId}>
      <h2 id={headingId}>Where it went</h2>
      <p className={styles.hint}>Tap one to see its spends.</p>
      <ul className={styles.list}>
        {shares.map((share) => {
          const look = categoryLook(share.id, categories);
          return (
            <li key={share.id}>
              <Link href={categoryHref(share.id, period, label)} className={styles.catLine}>
                <CategoryDisc emoji={look.emoji} color={look.color} />
                <span>
                  <span className={styles.catName}>{look.name}</span>
                  <span className={styles.catBar} aria-hidden="true">
                    <i style={{ width: `${Math.max(2, share.share * 100).toFixed(1)}%`, background: swatchSolid(look.color) }} />
                  </span>
                </span>
                <span className={styles.catSide}>
                  <b>{formatRupiah(share.amount)}</b>
                  <small>{shareLabel(share.share)}</small>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {more > 0 ? (
        <Button variant="quiet" className={styles.more} aria-expanded={showAll} onClick={onToggleAll}>
          {showAll ? "Show fewer" : `Show ${more} more`}
        </Button>
      ) : null}
    </section>
  );
}
