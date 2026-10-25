"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import { Sheet, SheetBody, SheetHead } from "@/components/ui/sheet";
import styles from "./menu.module.css";

const PLACES: { href: string; icon: IconName; name: string; note: string }[] = [
  { href: "/", icon: "check", name: "Home", note: "What is waiting to be checked" },
  { href: "/spending", icon: "chart", name: "Spending", note: "Totals, categories and biggest spends" },
  { href: "/transactions", icon: "list", name: "All transactions", note: "Search, filter and fix" },
  { href: "/categories", icon: "grid", name: "Categories", note: "Emoji, colour and order" },
];

/**
 * The menu sheet: the four places, and "Type in a spend" when the screen can open the spend form.
 * Render it only while it is open.
 */
export default function Menu({
  onClose,
  onTypeInSpend,
}: {
  onClose: () => void;
  /** Left out where there is no spend form (a whole-app state), and then so is the item. */
  onTypeInSpend?: () => void;
}) {
  return (
    <Sheet label="Menu" onClose={onClose}>
      <SheetHead title="Menu" />
      <SheetBody>
        <div className={styles.list}>
          {PLACES.map((place) => (
            <Link key={place.href} href={place.href} className={styles.item} onClick={onClose}>
              <span className={styles.icon}>
                <Icon name={place.icon} />
              </span>
              <span>
                <b>{place.name}</b>
                <small>{place.note}</small>
              </span>
              <Icon name="right" size={20} />
            </Link>
          ))}
          {onTypeInSpend ? (
            <button
              type="button"
              className={styles.item}
              onClick={() => {
                onClose();
                onTypeInSpend();
              }}
            >
              <span className={styles.icon}>
                <Icon name="pencil" />
              </span>
              <span>
                <b>Type in a spend</b>
                <small>Cash, or anything not in a screenshot</small>
              </span>
              <Icon name="right" size={20} />
            </button>
          ) : null}
        </div>
      </SheetBody>
    </Sheet>
  );
}
