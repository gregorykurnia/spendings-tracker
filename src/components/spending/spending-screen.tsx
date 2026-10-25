"use client";

import { useEffect, useState } from "react";
import { SubBar } from "@/components/app/app-bar";
import { ScreenSkeleton } from "@/components/app/screen-skeletons";
import { SpendForm } from "@/components/spend-form/spend-form";
import type { SpendFormMode } from "@/components/spend-form/rules";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyCard } from "@/components/ui/empty-card";
import { Segmented } from "@/components/ui/segmented";
import { StepButton } from "@/components/ui/step-button";
import { useToast } from "@/components/ui/toast";
import { useCategories } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import { todayISO } from "@/lib/dates";
import { makePeriod, navLabel, stepAnchor, switchMode, type PeriodMode } from "@/lib/periods";
import type { Transaction } from "@/types";
import { BiggestSpends } from "./biggest-spends";
import { CategoryLines } from "./category-lines";
import { DayChart } from "./day-chart";
import { Hero } from "./hero";
import styles from "./spending.module.css";
import { emptyWords, spendingView } from "./spending";

const MODES: { value: PeriodMode; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

type Choice = {
  mode: PeriodMode;
  /** Any date inside the period being looked at; `null` is today, so it keeps up with the calendar. */
  anchor: string | null;
  /** The day chosen on the chart; the biggest day while `null`. */
  picked: string | null;
  showAll: boolean;
};

type FormTarget = { kind: "add" } | { kind: "change"; spend: Transaction };

const FIRST_CHOICE: Choice = { mode: "month", anchor: null, picked: null, showAll: false };
// What was being looked at, so coming back from a category's spends (back link or the browser's Back)
// shows the same period. Kept for this visit only: a reload opens on this month again.
let lastChoice: Choice = FIRST_CHOICE;

/** For tests: open on this month again. */
export function forgetSpendingChoice() {
  lastChoice = FIRST_CHOICE;
}

/**
 * Spending: the total for a week or month and how it compares with the one before, where it went,
 * day by day, and the biggest spends. Week or month, earlier or later; a category opens its spends
 * in All transactions and a biggest spend opens the Change spend form.
 */
export function SpendingScreen() {
  const { spends, waiting, loading, ...tx } = useTransactions();
  const { categories, loading: loadingCategories } = useCategories();
  const { announce } = useToast();
  const [choice, setChoice] = useState<Choice>(() => lastChoice);
  const [form, setForm] = useState<FormTarget | null>(null);

  useEffect(() => {
    lastChoice = choice;
  }, [choice]);

  // The app's gate has the data already, but this screen's own listeners start empty for a moment:
  // without this it would say "Nothing to show yet" before they fill.
  if (loading || loadingCategories) return <ScreenSkeleton screen="spending" />;

  // Read on the client only (this part never renders on the server: the gate shows the skeleton).
  const today = todayISO();
  const anchor = choice.anchor ?? today;

  // The date to look at after a change, kept as `null` when it is today.
  function lookAt(mode: PeriodMode, next: string) {
    setChoice({ mode, anchor: next === today ? null : next, picked: null, showAll: false });
    announce(`Showing ${navLabel(makePeriod(mode, next, today), today)}.`);
  }

  function setMode(mode: PeriodMode) {
    lookAt(mode, switchMode(mode, anchor, today));
  }

  function step(dir: -1 | 1) {
    lookAt(choice.mode, stepAnchor(choice.mode, anchor, dir, today));
  }

  function backToNow() {
    lookAt(choice.mode, today);
    document.getElementById("main")?.focus({ preventScroll: true });
  }

  const typeIn = () => setForm({ kind: "add" });
  const firstUse = spends.length === 0 && waiting.length === 0;
  const view = spendingView(spends, categories, { ...choice, anchor }, today);
  const { period, summary } = view;

  // The form edits the live spend; once it is deleted from the form the data drops it, and the form
  // goes on showing the spend it opened with until it closes itself.
  const mode: SpendFormMode | null =
    form === null
      ? null
      : form.kind === "add"
        ? { kind: "add" }
        : { kind: "change", spend: spends.find((s) => s.id === form.spend.id) ?? form.spend };

  const unit = choice.mode;
  const words = emptyWords(view, waiting.length);

  return (
    <>
      <SubBar onTypeInSpend={typeIn} />
      <main id="main" tabIndex={-1} className={styles.sp}>
        <div className={styles.top}>
          <div className={styles.head}>
            <h1>Spending</h1>
            {firstUse ? null : (
              <Segmented label="Period length" value={choice.mode} options={MODES} onChange={setMode} />
            )}
          </div>
          {firstUse ? null : (
            <>
              <div className={styles.pnav}>
                <StepButton direction="left" label={`Earlier ${unit}`} onPress={() => step(-1)} />
                <p className={styles.pnavLabel}>{view.navLabel}</p>
                <StepButton
                  direction="right"
                  label={`Later ${unit}`}
                  disabled={period.current}
                  onPress={() => step(1)}
                />
              </div>
              {period.current ? null : (
                <div className={styles.pnow}>
                  <Button variant="quiet" onClick={backToNow}>
                    {`Back to this ${unit}`}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* One order for everyone (WCAG 1.3.2, 2.4.3): total, where it went, day by day, biggest spends.
            The phone shows it as one column; wide puts "where it went" beside the rest (spending.module.css). */}
        {firstUse ? (
          <EmptyCard
            icon="chart"
            title="Nothing to show yet."
            className={styles.emptyCard}
            actions={
              <ButtonLink variant="solid" href="/">
                Add your first screenshots
              </ButtonLink>
            }
          >
            <p>Once you have accepted some spending, you will see where it went here.</p>
          </EmptyCard>
        ) : (
          <>
            <Hero label={view.label} summary={summary} />
            {view.count === 0 ? (
              <EmptyCard
                icon="chart"
                title={words.what}
                className={styles.emptyCard}
                actions={waiting.length > 0 ? <ButtonLink href="/">{words.go}</ButtonLink> : undefined}
              >
                {words.waiting ? <p>{words.waiting}</p> : null}
              </EmptyCard>
            ) : (
              <>
                <CategoryLines
                  shares={view.categories.shown}
                  categories={categories}
                  period={period}
                  label={view.label}
                  more={view.categories.more}
                  showAll={choice.showAll}
                  onToggleAll={() => setChoice((c) => ({ ...c, showAll: !c.showAll }))}
                />
                <DayChart
                  days={view.days}
                  mode={choice.mode}
                  shown={view.shown}
                  last={view.last}
                  biggestDay={view.biggestDay}
                  today={today}
                  summary={view.chartSummary}
                  onPick={(date) => setChoice((c) => ({ ...c, picked: date }))}
                />
                <BiggestSpends
                  spends={view.biggest}
                  categories={categories}
                  today={today}
                  onOpen={(spend) => setForm({ kind: "change", spend })}
                />
              </>
            )}
          </>
        )}
      </main>
      {mode ? <SpendForm mode={mode} categories={categories} actions={tx} onClose={() => setForm(null)} /> : null}
    </>
  );
}
