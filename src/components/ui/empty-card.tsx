import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./empty-card.module.css";
import { Icon, type IconName } from "./icon";

type Props = {
  icon: IconName;
  /** What this is: one bold line. */
  title: string;
  /** Then the next step, in plain words. */
  children?: ReactNode;
  /** Buttons or links, side by side. */
  actions?: ReactNode;
  className?: string;
};

/** The card for "nothing here yet": the mark, what it is, and one next step. */
export function EmptyCard({ icon, title, children, actions, className }: Props) {
  return (
    <div className={cx(styles.empty, className)}>
      <span className={styles.mark}>
        <Icon name={icon} size={28} />
      </span>
      <p className={styles.title}>{title}</p>
      {children}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
