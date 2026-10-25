import type { CSSProperties } from "react";
import { cx } from "./cx";
import styles from "./skeleton.module.css";

type Shape =
  | "block" // a line of text
  | "short"
  | "mid"
  | "title"
  | "amount"
  | "search"
  | "button"
  | "buttonWide"
  | "segment"
  | "circle"
  | "disc"
  | "figure";

/** A grey piece standing in for what is loading. Pulses; still when motion is reduced. */
export function Sk({ shape = "block", className, style }: { shape?: Shape; className?: string; style?: CSSProperties }) {
  return <i className={cx(styles.sk, styles[shape], className)} style={style} aria-hidden="true" />;
}

/** `count` grey rows: a disc, two lines, a figure. */
export function SkRows({ count, className }: { count: number; className?: string }) {
  return (
    <ul className={cx(styles.rows, className)} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={styles.row}>
          <Sk shape="disc" />
          <span className={styles.text}>
            <Sk shape="block" />
            <Sk shape="short" />
          </span>
          <Sk shape="figure" />
        </li>
      ))}
    </ul>
  );
}
