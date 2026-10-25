"use client";

import { useEffect, useRef, useState } from "react";
import { SubBar } from "@/components/app/app-bar";
import { BootFailed } from "@/components/app/boot-states";
import { ScreenSkeleton } from "@/components/app/screen-skeletons";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/icon";
import { CategoryDisc } from "@/components/ui/pill";
import { StepButton } from "@/components/ui/step-button";
import { useToast } from "@/components/ui/toast";
import { useWriteGuard } from "@/components/ui/use-write-guard";
import { useCategories } from "@/hooks/useCategories";
import { useTransactionCounts } from "@/hooks/useTransactionCounts";
import type { Category } from "@/types";
import { CategoryForm } from "./category-form";
import { categoryCountLine, movedMessage, QUICK_CHOICES, spendCountLine, type CategoryFormMode } from "./organise";
import styles from "./organise.module.css";

type Target = { kind: "add" } | { kind: "change"; id: string; category: Category };

/** "Add" on a phone and "Add category" wide. Offline it is dimmed and says why when pressed. */
function AddCategoryButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const { blocked, refuse } = useWriteGuard(true);
  return (
    <button
      type="button"
      className={cx(styles.add, blocked && !disabled && styles.addOffline)}
      aria-label="Add category"
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (disabled) return;
        if (blocked) refuse();
        else onPress();
      }}
    >
      <Icon name="plus" />
      <span>
        Add<span className={styles.long}> category</span>
      </span>
    </button>
  );
}

/**
 * Categories: one row per category in the owner's order, with how many spends it has. A row opens
 * the form that changes it (and deletes it); "Change order" swaps the rows for arrows.
 */
export function CategoriesScreen() {
  const categories = useCategories();
  const { counts, loading: loadingCounts, error: countsError, retry } = useTransactionCounts();
  const { announce } = useToast();
  const [reorder, setReorder] = useState(false);
  const [form, setForm] = useState<Target | null>(null);
  // After a move the arrow that was pressed gets focus back in the row's new place.
  const refocus = useRef<{ id: string; direction: "up" | "down" } | null>(null);

  const sorted = [...categories.categories].sort((a, b) => a.order - b.order);

  useEffect(() => {
    const want = refocus.current;
    if (!want) return;
    refocus.current = null;
    const pick = (direction: string) =>
      document.querySelector<HTMLElement>(`#main [data-step="${want.id}-${direction}"]`);
    const same = pick(want.direction);
    const target = same?.getAttribute("aria-disabled") === "true" ? pick(want.direction === "up" ? "down" : "up") : same;
    target?.focus();
  });

  // The counts are what the rows say, so a failure to read them is a failure to load, never "No spends yet".
  // An open form stays (with what was typed) until it closes.
  if (countsError !== null && form === null) return <BootFailed screen="categories" what="transactions" onRetry={retry} />;
  if (categories.loading || loadingCounts) return <ScreenSkeleton screen="categories" />;

  const n = sorted.length;

  function toggleReorder() {
    const next = !reorder;
    setReorder(next);
    announce(next ? "Change order is on. Use the arrows." : "Order saved.");
  }

  async function move(category: Category, direction: "up" | "down") {
    refocus.current = { id: category.id, direction };
    const at = sorted.findIndex((c) => c.id === category.id);
    const to = direction === "up" ? at - 1 : at + 1;
    try {
      await categories.moveCategory(category.id, direction);
    } catch (err) {
      console.error("changing the order failed:", err);
      refocus.current = null;
      announce("Couldn't change the order. Try again in a moment.");
      return;
    }
    announce(movedMessage(category.name, to + 1, n));
  }

  // The form edits the live category; once it is deleted the data drops it, and the form goes on
  // showing the one it opened with until it closes itself.
  const mode: CategoryFormMode | null =
    form === null
      ? null
      : form.kind === "add"
        ? { kind: "add" }
        : { kind: "change", category: sorted.find((c) => c.id === form.id) ?? form.category };

  return (
    <>
      <SubBar />
      <main id="main" tabIndex={-1} className={styles.org}>
        <div className={styles.head}>
          <div>
            <h1>Categories</h1>
            <p className={styles.sub}>
              {categoryCountLine(n)}
              {reorder ? "" : ". Tap one to change it."}
            </p>
          </div>
          <AddCategoryButton disabled={reorder} onPress={() => setForm({ kind: "add" })} />
        </div>
        <div className={styles.ctl}>
          <Button variant={reorder ? "solid" : "outline"} aria-pressed={reorder} onClick={toggleReorder}>
            {reorder ? (
              <>
                <Icon name="check" />
                Done
              </>
            ) : (
              "Change order"
            )}
          </Button>
        </div>
        {reorder ? (
          <p className={styles.note}>
            Use the arrows to move a category. The first four are the quick choices when you check a spend.
          </p>
        ) : null}
        <ul className={styles.list}>
          {sorted.map((category, i) => {
            const disc = <CategoryDisc emoji={category.emoji} color={category.color} />;
            const text = (
              <span className={styles.main}>
                <span className={styles.name}>{category.name}</span>
                <span className={styles.count}>{spendCountLine(counts[category.id]?.spends ?? 0)}</span>
              </span>
            );
            return (
              <Row key={category.id} cut={reorder && i === QUICK_CHOICES}>
                {reorder ? (
                  <div className={cx(styles.line, styles.moving)}>
                    {disc}
                    {text}
                    <span className={styles.steps}>
                      <StepButton
                        direction="up"
                        label={`Move up: ${category.name}, now ${i + 1} of ${n}`}
                        disabled={i === 0}
                        writes
                        dataStep={`${category.id}-up`}
                        onPress={() => move(category, "up")}
                      />
                      <StepButton
                        direction="down"
                        label={`Move down: ${category.name}, now ${i + 1} of ${n}`}
                        disabled={i === n - 1}
                        writes
                        dataStep={`${category.id}-down`}
                        onPress={() => move(category, "down")}
                      />
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.line}
                    onClick={() => setForm({ kind: "change", id: category.id, category })}
                  >
                    {disc}
                    {text}
                    <span className={styles.go}>
                      <Icon name="right" />
                    </span>
                  </button>
                )}
              </Row>
            );
          })}
        </ul>
      </main>
      {mode ? (
        <CategoryForm
          mode={mode}
          categories={sorted}
          actions={categories}
          spends={mode.kind === "change" ? counts[mode.category.id]?.spends : undefined}
          onClose={() => setForm(null)}
        />
      ) : null}
    </>
  );
}

/** A row, with the dashed "Quick choices end here" line before it when asked. */
function Row({ cut, children }: { cut: boolean; children: React.ReactNode }) {
  return (
    <>
      {cut ? (
        <li className={styles.cut} aria-hidden="true">
          <span>Quick choices end here</span>
        </li>
      ) : null}
      <li>{children}</li>
    </>
  );
}
