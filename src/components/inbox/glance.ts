// The card at the top of home: this month so far, against the same days of the month before.

import { formatDigits, isLongTotal } from "@/lib/money";
import { heroLabel, summarise, type Spend } from "@/lib/periods";

export type Glance = {
  /** `October so far`. */
  label: string;
  /** The total without `Rp`, which the card shows smaller beside it. */
  digits: string;
  /** Ten digits or more: the figure drops to a smaller size so it fits a phone. */
  long: boolean;
  /** `Rp 475.650 lower than 1 to 25 September`. */
  comparison: string;
};

export function glanceFor(spends: readonly Spend[], today: string): Glance {
  const { period, total, comparison } = summarise(spends, "month", today, today);
  const label = heroLabel(period, today);
  return {
    label,
    digits: formatDigits(total),
    long: isLongTotal(total),
    comparison: comparison.short,
  };
}
