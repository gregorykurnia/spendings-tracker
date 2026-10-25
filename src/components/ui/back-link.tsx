import Link from "next/link";
import styles from "./back-link.module.css";
import { Icon } from "./icon";

/**
 * Every screen under home has its own way back, because an installed app has no browser back button.
 * `label` names where it goes: "Home", "Spending".
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={styles.back}>
      <Icon name="left" />
      {label}
    </Link>
  );
}
