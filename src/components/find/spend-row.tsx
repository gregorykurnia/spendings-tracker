import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/icon";
import { CategoryDisc } from "@/components/ui/pill";
import { categoryLook } from "@/components/spending/spending";
import { formatDay } from "@/lib/dates";
import { matchRanges } from "@/lib/filters";
import { formatRupiah } from "@/lib/money";
import { NO_CATEGORY_ID } from "@/lib/periods";
import type { Category, Transaction } from "@/types";
import styles from "./find.module.css";

/** The text with the parts that match the search words marked. */
export function Highlighted({ text, words }: { text: string; words: readonly string[] }) {
  const ranges = matchRanges(text, words);
  if (!ranges.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([start, end], i) => {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(<mark key={i}>{text.slice(start, end)}</mark>);
    at = end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

type Props = {
  spend: Transaction;
  categories: readonly Category[];
  today: string;
  /** The search words, to highlight in the store and the note. */
  words: readonly string[];
  /** The row was pressed: it opens in the Change spend form (P7). */
  onOpen: (spend: Transaction) => void;
};

/**
 * One saved spend, readable at a glance (F5): the category's emoji on its colour, the store as the
 * bank wrote it, "Category · note", the amount, the date and a small mark for where it came from.
 * A spend whose category was removed says "No category" in the alert colour.
 */
export function SpendRow({ spend, categories, today, words, onOpen }: Props) {
  const look = categoryLook(spend.categoryId, categories);
  const missing = look.id === NO_CATEGORY_ID;
  const typed = spend.source === "manual";
  return (
    <li>
      <button type="button" className={styles.line} onClick={() => onOpen(spend)}>
        <CategoryDisc emoji={look.emoji} color={look.color} />
        <span className={styles.main}>
          <span className={styles.store}>
            <Highlighted text={spend.store} words={words} />
          </span>
          <span className={styles.sub}>
            {missing ? (
              <span className={styles.none}>
                <Icon name="alert" size={16} />
                No category
              </span>
            ) : (
              look.name
            )}
            {spend.description ? (
              <>
                {" · "}
                <Highlighted text={spend.description} words={words} />
              </>
            ) : null}
          </span>
        </span>
        <span className={styles.side}>
          <b>{formatRupiah(spend.amount)}</b>
          <small className={cx(styles.when)}>
            <Icon name={typed ? "pencil" : "image"} size={14} />
            <span className="sr-only">{typed ? "Typed in. " : "From a screenshot. "}</span>
            {formatDay(spend.date, today)}
          </small>
        </span>
      </button>
    </li>
  );
}
