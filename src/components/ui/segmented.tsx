import styles from "./segmented.module.css";

type Props<T extends string> = {
  /** Names the group for screen readers: "Period length". */
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
};

/** Two or three choices side by side, one on: Week or Month. */
export function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <div className={styles.seg} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => option.value !== value && onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
