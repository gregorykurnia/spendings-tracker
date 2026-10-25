"use client";

import { useId, useRef, type PointerEvent } from "react";
import { cx } from "@/components/ui/cx";
import { StepButton } from "@/components/ui/step-button";
import type { PeriodMode } from "@/lib/periods";
import styles from "./spending.module.css";
import { readoutFor, type DayView } from "./spending";

type Props = {
  days: readonly DayView[];
  mode: PeriodMode;
  /** The day shown in the readout. */
  shown: number;
  /** The last day that can be picked. */
  last: number;
  biggestDay: number;
  today: string;
  /** What a screen reader hears for the chart: the biggest day. */
  summary: string;
  /** A day was chosen, by the step buttons or along the bars. */
  onPick: (date: string) => void;
};

/**
 * Day by day: the exact amount for one day above the bars, with step buttons beside it. The step
 * buttons are the way in for a keyboard or a screen reader; sliding a finger or the mouse along the
 * bars is an extra, because a month of 31 bars is too narrow to tap one at a time.
 */
export function DayChart({ days, mode, shown, last, biggestDay, today, summary, onPick }: Props) {
  const headingId = useId();
  const scrubbing = useRef(false);
  const day = shown >= 0 ? days[shown] : null;
  const readout = day ? readoutFor(day, biggestDay, today) : null;

  function pickAt(chart: HTMLElement, x: number) {
    const box = chart.getBoundingClientRect();
    if (!box.width) return;
    let i = Math.max(0, Math.min(days.length - 1, Math.floor(((x - box.left) / box.width) * days.length)));
    // Days still to come can't be picked: land on the last one that can.
    while (i > 0 && days[i].future) i--;
    if (!days[i].future) onPick(days[i].date);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    scrubbing.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // a synthetic pointer has nothing to capture
    }
    pickAt(event.currentTarget, event.clientX);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (scrubbing.current || event.pointerType === "mouse") pickAt(event.currentTarget, event.clientX);
  }

  const stop = () => {
    scrubbing.current = false;
  };

  return (
    <section className={cx(styles.sec, styles.days)} aria-labelledby={headingId}>
      <h2 id={headingId}>Day by day</h2>
      <div className={styles.readout}>
        <StepButton
          direction="left"
          label="Previous day"
          disabled={shown <= 0}
          onPress={() => onPick(days[shown - 1].date)}
        />
        <div className={styles.roMain} aria-live="polite" data-testid="day-readout">
          {readout ? (
            <>
              <span className={styles.roDate}>{readout.date}</span>
              <b className={cx(styles.roAmt, readout.none && styles.roNone)}>{readout.amount}</b>
              {readout.biggest ? <span className={styles.roTag}>Biggest day</span> : null}
            </>
          ) : null}
        </div>
        <StepButton
          direction="right"
          label="Next day"
          disabled={shown >= last}
          onPress={() => onPick(days[shown + 1].date)}
        />
      </div>
      <div
        className={styles.chart}
        role="img"
        aria-label={summary}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stop}
        onPointerCancel={stop}
      >
        <div className={cx(styles.plot, mode === "week" && styles.week)}>
          {days.map((d, i) => (
            <span
              key={d.date}
              className={cx(styles.day, i === shown && styles.on, d.future && styles.future, d.quiet && styles.zero)}
            >
              <i className={styles.bar} style={d.height > 0 ? { height: `${d.height}%` } : undefined} />
            </span>
          ))}
        </div>
        <div className={styles.axis} aria-hidden="true">
          {days.map((d) =>
            d.axis ? (
              <span key={d.date} style={{ left: `${d.axisAt.toFixed(2)}%` }}>
                {d.axis}
              </span>
            ) : null
          )}
        </div>
      </div>
    </section>
  );
}
