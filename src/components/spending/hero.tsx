import { Icon } from "@/components/ui/icon";
import { formatDigits, isLongTotal } from "@/lib/money";
import type { PeriodSummary } from "@/lib/periods";
import { cx } from "@/components/ui/cx";
import styles from "./spending.module.css";

/** The total for the period, and how it compares with the one before. No green or red. */
export function Hero({ label, summary }: { label: string; summary: PeriodSummary }) {
  const { comparison, total } = summary;
  const arrow = comparison.kind === "lower" ? "lower" : comparison.kind === "higher" ? "higher" : null;
  return (
    <section className={styles.hero} aria-labelledby="hero-label">
      <p className={styles.heroLabel} id="hero-label">
        {label}
      </p>
      <p className={cx(styles.heroAmount, isLongTotal(total) && styles.long)}>
        <small>Rp</small>
        {formatDigits(total)}
      </p>
      <p className={cx(styles.heroCmp, (comparison.kind === "none" || comparison.kind === "same") && styles.dim)}>
        {arrow ? <Icon name={arrow} size={22} /> : null}
        {comparison.line}
      </p>
      <p className={styles.heroSub}>{comparison.sub}</p>
    </section>
  );
}
