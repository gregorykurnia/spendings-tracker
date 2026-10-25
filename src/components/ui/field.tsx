"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { formatDayLong } from "@/lib/dates";
import { cx } from "./cx";
import styles from "./field.module.css";
import { Icon } from "./icon";

/* ---------- messages under a field ---------- */

/**
 * A field error: what is wrong and what to do. `net` is the no-connection error under a form: it
 * sits in a box and is announced as an alert.
 */
export function FieldError({ id, net, children }: { id?: string; net?: boolean; children: ReactNode }) {
  return (
    <p id={id} className={cx(styles.err, net && styles.net)} role={net ? "alert" : undefined}>
      <Icon name="alert" size={18} />
      <span>{children}</span>
    </p>
  );
}

/** A quiet line under a field. */
export function Hint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className={styles.hint}>
      {children}
    </p>
  );
}

/** What is still needed, above the buttons: "Still needed: store and amount." */
export function FieldSummary({ children }: { children: ReactNode }) {
  return <p className={styles.sum}>{children}</p>;
}

/* ---------- the frame every field shares ---------- */

type FrameProps = {
  label: string;
  hint?: string;
  error?: string;
  /** The id of the control, for the label. */
  controlId: string;
  hintId: string;
  errorId: string;
  className?: string;
  children: ReactNode;
};

function Frame({ label, hint, error, controlId, hintId, errorId, className, children }: FrameProps) {
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={controlId} className={styles.label}>
        {label}
      </label>
      {children}
      {hint && !error ? <Hint id={hintId}>{hint}</Hint> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

/** The attributes that tie a control to its message. */
function describedBy(hint: string | undefined, error: string | undefined, hintId: string, errorId: string) {
  if (error) return errorId;
  return hint ? hintId : undefined;
}

type FieldProps = {
  label: string;
  hint?: string;
  /** Shown under the field, which turns alert-coloured. Ties to the control for screen readers. */
  error?: string;
  className?: string;
};

/* ---------- text ---------- */

export function TextField({
  label,
  hint,
  error,
  className,
  ...input
}: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, "className">) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-err`;
  return (
    <Frame label={label} hint={hint} error={error} controlId={id} hintId={hintId} errorId={errorId} className={className}>
      <input
        type="text"
        autoComplete="off"
        {...input}
        id={id}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, hintId, errorId)}
      />
    </Frame>
  );
}

/* ---------- amount: "Rp" before the figures ---------- */

export function AmountField({
  label,
  hint,
  error,
  className,
  ...input
}: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, "className">) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-err`;
  return (
    <Frame label={label} hint={hint} error={error} controlId={id} hintId={hintId} errorId={errorId} className={className}>
      <div className={styles.amountBox}>
        <span className={styles.rp} aria-hidden="true">
          Rp
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          {...input}
          id={id}
          className={cx(styles.input, styles.amount)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hint, error, hintId, errorId)}
        />
      </div>
    </Frame>
  );
}

/* ---------- date: the native picker under a formatted label ---------- */

type DateFieldProps = FieldProps & {
  /** `YYYY-MM-DD`, or `""` when there is none. */
  value: string;
  onChange: (value: string) => void;
  /** What to write when there is no date. */
  placeholder?: string;
  readOnly?: boolean;
  onBlur?: () => void;
};

export function DateField({
  label,
  hint,
  error,
  className,
  value,
  onChange,
  placeholder = "Choose a date",
  readOnly,
  onBlur,
}: DateFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-err`;
  return (
    <Frame label={label} hint={hint} error={error} controlId={id} hintId={hintId} errorId={errorId} className={className}>
      <div
        className={styles.dateBox}
        data-invalid={error ? "true" : undefined}
        data-readonly={readOnly ? "true" : undefined}
      >
        <span>{value ? formatDayLong(value) : placeholder}</span>
        <Icon name="calendar" />
        <input
          id={id}
          type="date"
          value={value}
          disabled={readOnly}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hint, error, hintId, errorId)}
        />
      </div>
    </Frame>
  );
}

/* ---------- search: a pill with a magnifier and a clear button ---------- */

export function SearchField({
  label = "Search",
  value,
  onClear,
  className,
  ...input
}: {
  /** Not shown; it names the field for screen readers. */
  label?: string;
  value: string;
  onClear: () => void;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type" | "value" | "aria-label">) {
  return (
    <div className={cx(styles.search, className)}>
      <span className={styles.searchIcon}>
        <Icon name="search" />
      </span>
      <input
        autoComplete="off"
        enterKeyHint="search"
        {...input}
        type="search"
        value={value}
        aria-label={label}
        className={cx(styles.input, styles.searchInput)}
      />
      {value ? (
        <button type="button" className={styles.clear} onClick={onClear} aria-label="Clear search">
          <Icon name="close" />
        </button>
      ) : null}
    </div>
  );
}

/* ---------- select: a pill with a chevron (the order menu) ---------- */

export function SelectField({
  label,
  className,
  children,
  ...select
}: {
  /** Not shown; it names the control for screen readers. */
  label: string;
  className?: string;
  children: ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "aria-label">) {
  return (
    <span className={cx(styles.select, className)}>
      <select {...select} aria-label={label}>
        {children}
      </select>
      <Icon name="down" />
    </span>
  );
}
