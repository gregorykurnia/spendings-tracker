"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useCategories } from "@/hooks/useCategories";
import { useOnline } from "@/hooks/useOnline";
import { useTransactions } from "@/hooks/useTransactions";
import { bootState, screenFor, type BootState, type ScreenName } from "@/lib/boot";
import { BootFailed, BootLoading, BootOffline, BootSetup } from "./boot-states";

/** How long "Trying again…" shows at least, so a retry that fails at once is still seen to happen. */
export const RETRY_FEEDBACK_MS = 700;

/** Said under "Try again" when the retry found no connection either. */
export const STILL_OFFLINE = "Still no connection.";

type Retry = {
  /** The state being retried: it stays on screen, saying "Trying again…". */
  from: BootState;
  /** Still inside the minimum feedback time. */
  hold: boolean;
};

/**
 * Puts a whole-app state (setting up, loading, couldn't load, no connection) in place of the screen
 * until the screen's data is there. Other paths (the 404, an unknown address) pass straight through.
 */
export default function AppGate({ children }: { children: ReactNode }) {
  const screen = screenFor(usePathname());
  // A retry starts the data hooks over by remounting the part that holds them.
  const [attempt, setAttempt] = useState(0);
  const [retry, setRetry] = useState<Retry | null>(null);
  const [note, setNote] = useState<string | undefined>(undefined);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // A retry remounts the state screen, so the "Try again" that had focus is gone: focus goes to the
  // new one, and to the screen (`#main`) once it loads.
  const keepFocus = useRef(false);

  useEffect(() => () => clearTimeout(holdTimer.current), []);

  useEffect(() => {
    if (!keepFocus.current) return;
    const target =
      document.querySelector<HTMLElement>("[data-retry]") ?? document.getElementById("main");
    target?.focus();
    if (retry === null) keepFocus.current = false;
  }, [attempt, retry]);

  const startRetry = useCallback((from: BootState) => {
    keepFocus.current = Boolean(document.activeElement?.closest("[data-retry]"));
    setRetry({ from, hold: true });
    setNote(undefined);
    setAttempt((n) => n + 1);
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(
      () => setRetry((r) => (r ? { ...r, hold: false } : r)),
      RETRY_FEEDBACK_MS
    );
  }, []);

  const settle = useCallback((state: BootState) => {
    setRetry(null);
    setNote(state.kind === "offline" ? STILL_OFFLINE : undefined);
  }, []);

  if (!screen) return <>{children}</>;
  return (
    <Gate
      key={attempt}
      screen={screen}
      retry={retry}
      note={note}
      onRetry={startRetry}
      onSettled={settle}
    >
      {children}
    </Gate>
  );
}

function Gate({
  screen,
  retry,
  note,
  onRetry,
  onSettled,
  children,
}: {
  screen: ScreenName;
  retry: Retry | null;
  note: string | undefined;
  onRetry: (from: BootState) => void;
  onSettled: (state: BootState) => void;
  children: ReactNode;
}) {
  const online = useOnline();
  const categories = useCategories();
  const transactions = useTransactions();

  const state = bootState({
    screen,
    online,
    categories: {
      loading: categories.loading,
      error: categories.error,
      count: categories.categories.length,
    },
    seeding: categories.seeding,
    transactions: { loading: transactions.loading, error: transactions.error },
  });

  // While a retry is under way the screen that failed stays up, saying so.
  const retrying = retry !== null && (retry.hold || state.kind === "loading");
  const shown = retrying && retry ? retry.from : state;

  useEffect(() => {
    if (retry && !retry.hold && state.kind !== "loading") onSettled(state);
  }, [retry, state, onSettled]);

  // Back online after a failure that happened while offline: try again without being asked.
  const wasOnline = useRef(online);
  useEffect(() => {
    const cameBack = !wasOnline.current && online;
    wasOnline.current = online;
    if (cameBack && state.kind === "failed") onRetry(state);
  }, [online, state, onRetry]);

  switch (shown.kind) {
    case "setup":
      return <BootSetup done={shown.done} total={shown.total} />;
    case "offline":
      return <BootOffline retrying={retrying} note={note} onRetry={() => onRetry(shown)} />;
    case "failed":
      return (
        <BootFailed
          screen={screen}
          what={shown.what}
          retrying={retrying}
          onRetry={() => onRetry(shown)}
        />
      );
    case "loading":
      return <BootLoading screen={screen} />;
    case "ready":
      return <>{children}</>;
  }
}
