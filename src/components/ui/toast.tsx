"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./toast.module.css";

/** How long a toast stays: one line, past tense, no buttons (design notes §4). */
export const TOAST_MS = 4200;

type Feedback = {
  /** Shows one short line at the bottom for a few seconds. */
  toast: (message: string) => void;
  /** Tells screen readers, politely. Results, progress, accepted and deleted go here. */
  announce: (message: string) => void;
};

const nothing: Feedback = { toast: () => {}, announce: () => {} };
const FeedbackContext = createContext<Feedback>(nothing);

export function useToast() {
  return useContext(FeedbackContext);
}

/**
 * Holds the toast and the polite live region. It renders them after its children, so wrap the
 * page content (`#app`) and nothing else: an open sheet makes `#app` inert, and these must stay
 * readable.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const [shown, setShown] = useState(false);
  const [live, setLive] = useState("");
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(hideTimer.current);
      clearTimeout(liveTimer.current);
    },
    []
  );

  const toast = useCallback((next: string) => {
    setMessage(next);
    setShown(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShown(false), TOAST_MS);
  }, []);

  const announce = useCallback((next: string) => {
    // Empty first, so the same words said twice are read twice.
    setLive("");
    clearTimeout(liveTimer.current);
    liveTimer.current = setTimeout(() => setLive(next), 30);
  }, []);

  const value = useMemo(() => ({ toast, announce }), [toast, announce]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div
        id="toast"
        className={`${styles.toast} ${shown ? styles.show : ""}`}
        data-shown={shown}
        role="status"
      >
        {message}
      </div>
      <div id="live" className="sr-only" role="status" aria-live="polite">
        {live}
      </div>
    </FeedbackContext.Provider>
  );
}
