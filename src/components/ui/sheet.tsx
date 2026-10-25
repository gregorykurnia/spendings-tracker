"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";
import { Icon } from "./icon";
import styles from "./sheet.module.css";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** What a Tab key does inside a sheet: stays inside it, wrapping at both ends. */
export function nextFocus(
  focusable: readonly HTMLElement[],
  current: Element | null,
  panel: HTMLElement,
  shift: boolean
): HTMLElement | "stay" | null {
  if (!focusable.length) return "stay"; // nothing to land on: keep focus where it is
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (shift && (current === first || current === panel)) return last;
  if (!shift && current === last) return first;
  // Focus has slipped outside the sheet (a click on the scrim, say): bring it back.
  if (!current || !panel.contains(current)) return shift ? last : first;
  return null; // the browser's own Tab is fine
}

type Layer = { id: string; root: HTMLElement };
const layers: Layer[] = [];

/** The page and every sheet below the top one can't be reached while a sheet is open. */
function syncInert() {
  const app = document.getElementById("app");
  if (app) app.inert = layers.length > 0;
  layers.forEach((layer, i) => {
    layer.root.inert = i < layers.length - 1;
  });
}

const SheetContext = createContext<{ dismiss: () => void }>({ dismiss: () => {} });

type SheetProps = {
  /** Names the sheet for screen readers. */
  label: string;
  /** Asked to close: Escape, a tap on the grey, the close button. */
  onClose: () => void;
  /** Saving or deleting: the sheet can't be dismissed until it is done. */
  busy?: boolean;
  /** `alertdialog` for a question that needs an answer (delete). */
  role?: "dialog" | "alertdialog";
  className?: string;
  children: ReactNode;
};

/**
 * A sheet rising from the bottom on a phone, a centred dialog from 700 wide. Render it only while it
 * is open. It moves focus in, keeps Tab inside, closes on Escape, and puts focus back on whatever
 * opened it. Use `SheetHead`, `SheetBody` and `SheetFoot` inside.
 */
export function Sheet({ label, onClose, busy, role = "dialog", className, children }: SheetProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The latest values, for listeners that outlive a render.
  const live = useRef({ onClose, busy });
  useEffect(() => {
    live.current = { onClose, busy };
  });

  const dismiss = useCallback(() => {
    if (!live.current.busy) live.current.onClose();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const panel = panelRef.current;
    if (!root || !panel) return;
    // Nothing focused (the body) is no opener: closing then goes to the main area.
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && active !== document.body ? active : null;

    layers.push({ id, root });
    syncInert();
    const first = panel.querySelector<HTMLElement>("[data-autofocus]") ?? panel;
    first.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (layers[layers.length - 1]?.id !== id) return; // only the top sheet answers
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !el.hidden && el.getAttribute("aria-hidden") !== "true"
      );
      const target = nextFocus(focusable, document.activeElement, panel, event.shiftKey);
      if (target === null) return;
      event.preventDefault();
      if (target !== "stay") target.focus();
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const at = layers.findIndex((layer) => layer.id === id);
      if (at >= 0) layers.splice(at, 1);
      syncInert();
      if (layers.length) return; // another sheet is still open, and keeps its own focus
      // Back to what opened it; if that is gone, to the page's main area.
      const back = opener && opener.isConnected ? opener : document.getElementById("main");
      back?.focus({ preventScroll: true });
    };
  }, [id, dismiss]);

  const context = useMemo(() => ({ dismiss }), [dismiss]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div ref={rootRef} className={styles.ov}>
      <div className={styles.scrim} onClick={dismiss} />
      <div
        ref={panelRef}
        className={cx(styles.panel, className)}
        role={role}
        aria-modal="true"
        aria-label={label}
        aria-busy={busy || undefined}
        tabIndex={-1}
      >
        <SheetContext.Provider value={context}>{children}</SheetContext.Provider>
      </div>
    </div>,
    document.body
  );
}

/** The title and the close button. */
export function SheetHead({ title, closeLabel = "Close" }: { title: string; closeLabel?: string }) {
  const { dismiss } = useContext(SheetContext);
  return (
    <div className={styles.head}>
      <h2>{title}</h2>
      <button type="button" className={styles.close} onClick={dismiss} aria-label={closeLabel}>
        <Icon name="close" />
      </button>
    </div>
  );
}

/** The scrolling middle. */
export function SheetBody({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}

/** The fixed bottom: buttons, and the line that says what is still needed. */
export function SheetFoot({ children }: { children: ReactNode }) {
  return <div className={styles.foot}>{children}</div>;
}

/** Two buttons side by side on a phone, right-aligned in a dialog. The safe button comes first. */
export function SheetButtons({ children }: { children: ReactNode }) {
  return <div className={styles.buttons}>{children}</div>;
}
