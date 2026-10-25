"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import styles from "./button.module.css";
import { cx } from "./cx";
import { useWriteGuard } from "./use-write-guard";

export type ButtonVariant = "outline" | "solid" | "quiet" | "danger" | "dangerOutline";

type Look = {
  variant?: ButtonVariant;
  /** 52 high instead of 44. */
  size?: "default" | "big";
};

/** The class names of a button, for an element that isn't a `<button>` (a link, say). */
export function buttonClass({ variant = "outline", size = "default" }: Look = {}, extra?: string) {
  return cx(
    styles.btn,
    variant === "solid" && styles.solid,
    variant === "quiet" && styles.quiet,
    variant === "danger" && styles.danger,
    variant === "dangerOutline" && styles.dangerOutline,
    size === "big" && styles.big,
    extra
  );
}

type ButtonProps = Look &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> & {
    /**
     * Not ready. Uses `aria-disabled`, not `disabled`, so the button stays in the tab order and
     * readable, and pressing it does nothing.
     */
    disabled?: boolean;
    /** Waiting for something: a spinner and `busyLabel` (the verb in progress, such as "Saving…"). */
    busy?: boolean;
    busyLabel?: string;
    /** This button changes data: offline it is dimmed and says why when pressed. */
    writes?: boolean;
  };

export function Button({
  variant,
  size,
  disabled,
  busy,
  busyLabel,
  writes,
  className,
  type = "button",
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const { blocked, refuse } = useWriteGuard(writes);
  const inert = Boolean(disabled || busy);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (inert) {
      event.preventDefault();
      return;
    }
    if (blocked) {
      event.preventDefault();
      refuse();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      type={type}
      className={cx(
        buttonClass({ variant, size }, className),
        busy && styles.busy,
        blocked && styles.offline
      )}
      aria-disabled={inert || undefined}
      aria-busy={busy || undefined}
      onClick={handleClick}
    >
      {busy ? (
        <>
          <span className={styles.spin} aria-hidden="true" />
          {busyLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

type ButtonLinkProps = Look &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; children: ReactNode };

/** A link that looks like a button. */
export function ButtonLink({ variant, size, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link {...rest} className={buttonClass({ variant, size }, className)}>
      {children}
    </Link>
  );
}
