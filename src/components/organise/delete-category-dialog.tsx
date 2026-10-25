"use client";

import { useEffect, useState } from "react";
import { Button, Spinner } from "@/components/ui/button";
import { Chip, Chips } from "@/components/ui/chip";
import { FieldError } from "@/components/ui/field";
import { CategoryDisc } from "@/components/ui/pill";
import { Sheet, SheetBody, SheetButtons, SheetFoot, SheetHead } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { CategoryInUseError, type useCategories } from "@/hooks/useCategories";
import { useOnline } from "@/hooks/useOnline";
import { NET_ERROR } from "@/lib/offline";
import type { Category, CategoryUsage } from "@/types";
import { deleteButtonLabel, deleteNote, deletedMessage, plural, usedBy } from "./organise";
import styles from "./organise.module.css";

type Actions = Pick<ReturnType<typeof useCategories>, "categoryUsage" | "deleteCategory">;

type Props = {
  category: Category;
  /** Every other category: where the spends and waiting lines can go. */
  others: readonly Category[];
  actions: Actions;
  /** How many spends the list says it has, shown until the check answers. */
  knownSpends?: number;
  /** "Cancel": back to the form. */
  onCancel: () => void;
  /** The category is gone. */
  onDeleted: () => void;
};

const CHECK_FAILED = "Couldn't check whether it is used. Try again in a moment.";

/**
 * Deleting a category asks first (O6). It checks whether anything uses it, then either says it is
 * removed for good, or asks where the spends and waiting lines go first (no default), moves them
 * and deletes. Once it is running it can't be dismissed.
 */
export function DeleteCategoryDialog({ category, others, actions, knownSpends, onCancel, onDeleted }: Props) {
  const online = useOnline();
  const { toast, announce } = useToast();
  const [usage, setUsage] = useState<CategoryUsage | null>(null);
  const [checking, setChecking] = useState(true);
  const [dest, setDest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const { categoryUsage } = actions;
  useEffect(() => {
    let current = true;
    categoryUsage(category.id).then(
      (found) => {
        if (!current) return;
        setUsage(found);
        setChecking(false);
        setError("");
      },
      (err) => {
        console.error("checking a category failed:", err);
        if (!current) return;
        setChecking(false);
        setError(navigator.onLine ? CHECK_FAILED : NET_ERROR);
      }
    );
    return () => {
      current = false;
    };
  }, [categoryUsage, category.id, attempt]);

  function recheck() {
    setUsage(null);
    setChecking(true);
    setAttempt((n) => n + 1);
  }

  const used = usage ? usedBy(usage.spends, usage.waiting) : 0;
  const destination = others.find((c) => c.id === dest);

  async function remove() {
    if (busy || !usage) return;
    if (!online) {
      setError(NET_ERROR);
      announce(NET_ERROR);
      return;
    }
    setError("");
    setBusy(true);
    try {
      await actions.deleteCategory(category.id, used ? dest : undefined);
    } catch (err) {
      setBusy(false);
      if (err instanceof CategoryInUseError) {
        // Something was added to it since the check: ask again with the new count.
        recheck();
        return;
      }
      console.error("deleting a category failed:", err);
      setError(navigator.onLine ? "Couldn't delete this category. Try again in a moment." : NET_ERROR);
      return;
    }
    const done = deletedMessage(category.name, used, destination?.name);
    toast(done);
    announce(done);
    onDeleted();
  }

  const shownSpends = usage?.spends ?? knownSpends ?? 0;

  return (
    <Sheet label="Delete this category?" role="alertdialog" onClose={onCancel} busy={busy}>
      <SheetHead title={`Delete ${category.name}?`} noClose={busy} />
      <SheetBody>
        <div className={styles.question}>
          <div className={styles.card}>
            <CategoryDisc emoji={category.emoji} color={category.color} />
            <span className={styles.main}>
              <span className={styles.name}>{category.name}</span>
              <span className={styles.count}>{shownSpends ? plural(shownSpends, "spend", "spends") : "No spends"}</span>
            </span>
          </div>
          {checking ? (
            <p className={styles.checking} role="status">
              <Spinner />
              Checking if it is used…
            </p>
          ) : null}
          {usage && !used ? <p className={styles.moveNote}>No spends use it. It is removed for good.</p> : null}
          {usage && used ? (
            <>
              <p className={styles.moveNote}>{deleteNote(usage.spends, usage.waiting)}</p>
              <div className={styles.group}>
                <span className={styles.groupLabel} aria-hidden="true">
                  Move to
                </span>
                <Chips label="Move to">
                  {others.map((c) => (
                    <Chip key={c.id} emoji={c.emoji} on={c.id === dest} disabled={busy} onClick={() => setDest(c.id)}>
                      {c.name}
                    </Chip>
                  ))}
                </Chips>
              </div>
            </>
          ) : null}
          {error ? <FieldError net>{error}</FieldError> : null}
        </div>
      </SheetBody>
      <SheetFoot>
        <SheetButtons>
          <Button size="big" disabled={busy} onClick={onCancel} data-autofocus={busy ? undefined : ""}>
            Cancel
          </Button>
          {!usage && !checking ? (
            <Button size="big" variant="solid" onClick={recheck}>
              Try again
            </Button>
          ) : null}
          {usage && !used ? (
            <Button size="big" variant="danger" busy={busy} busyLabel="Deleting…" onClick={remove}>
              Delete
            </Button>
          ) : null}
          {usage && used ? (
            <Button
              size="big"
              variant="danger"
              disabled={!destination}
              busy={busy}
              busyLabel="Moving and deleting…"
              onClick={remove}
            >
              {deleteButtonLabel(used, Boolean(destination))}
            </Button>
          ) : null}
        </SheetButtons>
      </SheetFoot>
    </Sheet>
  );
}
