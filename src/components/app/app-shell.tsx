"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import AppGate from "./app-gate";
import styles from "./app-shell.module.css";

/** The skip link: the first thing a keyboard reaches, and it jumps over the bar to the content. */
function SkipLink() {
  return (
    <a
      href="#main"
      className={styles.skip}
      onClick={(event) => {
        event.preventDefault();
        document.getElementById("main")?.focus();
      }}
    >
      Skip to the content
    </a>
  );
}

/**
 * Everything every screen shares. `#app` is the page: an open sheet makes it inert. The toast and the
 * polite live region sit outside it, so they still work while a sheet is open.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className={styles.statusCover} aria-hidden="true" />
      <div id="app">
        <SkipLink />
        <AppGate>{children}</AppGate>
      </div>
    </ToastProvider>
  );
}
