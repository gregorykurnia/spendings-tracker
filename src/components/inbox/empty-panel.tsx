import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/icon";
import styles from "./home.module.css";

type Props = {
  /** Nothing has ever been added: three steps instead of "All checked". */
  firstUse: boolean;
  /** The "Add screenshots" button, which is the screen's own. */
  add: ReactNode;
  onTypeInSpend: () => void;
};

const STEPS = [
  "Take a screenshot of your transactions in the banking app.",
  "Add it here. It is read for you.",
  "Check what was found, then accept it.",
];

/** Where the inbox would be when nothing is waiting: "All checked", or the first-use steps. */
export function EmptyPanel({ firstUse, add, onTypeInSpend }: Props) {
  return (
    <div className={cx(styles.empty, firstUse && styles.first)}>
      <span className={styles.mark}>
        <Icon name={firstUse ? "image" : "check"} size={28} />
      </span>
      {firstUse ? (
        <ol className={styles.steps}>
          {STEPS.map((step, i) => (
            <li key={step}>
              <i aria-hidden="true">{i + 1}</i>
              {step}
            </li>
          ))}
        </ol>
      ) : (
        <p>Add screenshots from your banking app and the spending in them shows up here to check.</p>
      )}
      <div className={styles.act}>
        {add}
        <Button onClick={onTypeInSpend}>Type in a spend</Button>
      </div>
    </div>
  );
}
