import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import styles from "./home.module.css";

const PLACES: { href: string; icon: IconName; name: string; note: string }[] = [
  { href: "/spending", icon: "chart", name: "Spending", note: "Totals, categories and biggest spends" },
  { href: "/transactions", icon: "list", name: "All transactions", note: "Search, filter and fix" },
  { href: "/categories", icon: "grid", name: "Categories", note: "Emoji, colour and order" },
];

function Words({ icon, name, note }: { icon: IconName; name: string; note: string }) {
  return (
    <>
      <span className={styles.linkIcon}>
        <Icon name={icon} />
      </span>
      <span>
        <b>{name}</b>
        <small>{note}</small>
      </span>
      <Icon name="right" size={20} />
    </>
  );
}

/** Under the glance card: the other screens, and typing a spend in. */
export function HomeLinks({ onTypeInSpend }: { onTypeInSpend: () => void }) {
  return (
    <nav className={styles.links} aria-label="More">
      {PLACES.map((place) => (
        <Link key={place.href} href={place.href} className={styles.link}>
          <Words {...place} />
        </Link>
      ))}
      <button type="button" className={styles.link} onClick={onTypeInSpend}>
        <Words icon="pencil" name="Type in a spend" note="Cash, or anything not in a screenshot" />
      </button>
    </nav>
  );
}
