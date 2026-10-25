import { swatchTint } from "@/lib/swatches";
import { cx } from "./cx";
import styles from "./pill.module.css";

type CategoryLook = { emoji: string; name: string; color: string };

/** A category as its emoji and name on the colour the owner chose. Wraps for long names. */
export function Pill({ category }: { category: CategoryLook }) {
  return (
    <span className={styles.pill} style={{ background: swatchTint(category.color) }}>
      <i aria-hidden="true">{category.emoji}</i>
      {category.name}
    </span>
  );
}

/** The category's emoji on its tint: 44 across, or 56 when `big`. The name is always written beside it. */
export function CategoryDisc({
  emoji,
  color,
  big,
}: {
  emoji: string;
  color: string;
  big?: boolean;
}) {
  return (
    <span
      className={cx(styles.disc, big && styles.big)}
      style={{ background: swatchTint(color) }}
      aria-hidden="true"
    >
      {emoji}
    </span>
  );
}
