import Link from "next/link";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/icon";
import type { Spend } from "@/lib/periods";
import { glanceFor } from "./glance";
import styles from "./home.module.css";

/** This month so far against the same days of last month, opening Spending. */
export function GlanceCard({ spends, today }: { spends: readonly Spend[]; today: string }) {
  const glance = glanceFor(spends, today);
  return (
    <Link href="/spending" className={styles.glance}>
      <span className={styles.top}>
        {glance.label}
        <Icon name="right" size={20} />
      </span>
      <span className={cx(styles.amount, glance.long && styles.amountLong)}>
        <small>Rp </small>
        {glance.digits}
      </span>
      <span className={styles.cmp}>{glance.comparison}</span>
      {/* The link is named by its visible words (WCAG 2.5.3), plus where it goes. */}
      <span className="sr-only">. Open spending.</span>
    </Link>
  );
}
