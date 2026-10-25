"use client";

import Link from "next/link";
import { useState } from "react";
import { BackLink } from "@/components/ui/back-link";
import { Icon, Logo } from "@/components/ui/icon";
import styles from "./app-bar.module.css";
import Menu from "./menu";
import OfflineNotice from "./offline-notice";

type BarProps = {
  /** Opens the spend form from the menu. Left out where there is no form. */
  onTypeInSpend?: () => void;
};

function Tools({ onTypeInSpend }: BarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={styles.tools}>
      <Link href="/transactions?focus=search" className={styles.iconBtn} aria-label="Search">
        <Icon name="search" />
      </Link>
      <button
        type="button"
        className={styles.iconBtn}
        aria-label="Menu"
        aria-haspopup="dialog"
        onClick={() => setMenuOpen(true)}
      >
        <Icon name="menu" />
      </button>
      {menuOpen ? <Menu onClose={() => setMenuOpen(false)} onTypeInSpend={onTypeInSpend} /> : null}
    </div>
  );
}

/** The top of home: the name, search, and the menu. The offline notice sits under it. */
export function AppBar({ onTypeInSpend }: BarProps) {
  return (
    <>
      <header className={styles.bar}>
        <Link href="/" className={styles.brand}>
          <Logo />
          Daybook
        </Link>
        <Tools onTypeInSpend={onTypeInSpend} />
      </header>
      <OfflineNotice />
    </>
  );
}

/** The top of every other screen: a way back, search, and the menu. */
export function SubBar({ href = "/", label = "Home", onTypeInSpend }: BarProps & { href?: string; label?: string }) {
  return (
    <>
      <header className={styles.bar}>
        <BackLink href={href} label={label} />
        <Tools onTypeInSpend={onTypeInSpend} />
      </header>
      <OfflineNotice />
    </>
  );
}
