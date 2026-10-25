"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, FieldSummary, TextField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { CategoryDisc, Pill } from "@/components/ui/pill";
import { Sheet, SheetBody, SheetButtons, SheetFoot, SheetHead } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useOnline } from "@/hooks/useOnline";
import type { useCategories } from "@/hooks/useCategories";
import { NET_ERROR } from "@/lib/offline";
import { leastUsedSwatch, swatchFor, swatchSolid, swatchTint, SWATCH_NAMES, type SwatchName } from "@/lib/swatches";
import type { Category } from "@/types";
import { DeleteCategoryDialog } from "./delete-category-dialog";
import {
  firstGrapheme,
  missingFields,
  notSavedMessage,
  problems,
  savedMessage,
  startingDraft,
  SUGGESTED_EMOJI,
  summaryLine,
  type CategoryDraft,
  type CategoryField,
  type CategoryFormMode,
} from "./organise";
import styles from "./organise.module.css";

/** The hook functions the form calls; the screen passes them from its own `useCategories()`. */
export type CategoryFormActions = Pick<
  ReturnType<typeof useCategories>,
  "addCategory" | "updateCategory" | "categoryUsage" | "deleteCategory"
>;

type Props = {
  mode: CategoryFormMode;
  /** Every category, in the owner's order. */
  categories: readonly Category[];
  actions: CategoryFormActions;
  /** Closed without a change, saved or deleted. */
  onClose: () => void;
};

const swatchLabel = (name: SwatchName) => name[0].toUpperCase() + name.slice(1);

/**
 * The one form to add a category or change one: a live preview, a name, an emoji (28 to tap, or any
 * one typed or pasted) and one of 13 colours. A change also offers the delete question. Render it
 * only while it is open.
 */
export function CategoryForm({ mode, categories, actions, onClose }: Props) {
  const online = useOnline();
  const { toast, announce } = useToast();
  const changing = mode.kind === "change";
  const [draft, setDraft] = useState<CategoryDraft>(() => startingDraft(mode, leastUsedSwatch(categories)));
  const [touched, setTouched] = useState<Partial<Record<CategoryField, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const body = useRef<HTMLDivElement>(null);

  const found = problems(draft, categories, changing ? mode.category.id : undefined);
  const keys = missingFields(found);
  const errorFor = (key: CategoryField) => (attempted || touched[key] ? found[key] : undefined);

  function set(patch: Partial<CategoryDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function touch(key: CategoryField) {
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  }

  async function submit() {
    if (busy) return;
    if (keys.length) {
      setAttempted(true);
      body.current?.querySelector<HTMLElement>(`[name="${keys[0] === "name" ? "name" : "emoji"}"]`)?.focus();
      announce(notSavedMessage(keys));
      return;
    }
    if (!online) {
      setError(NET_ERROR);
      announce(NET_ERROR);
      return;
    }
    setError("");
    setBusy(true);
    const name = draft.name.trim();
    // Always a swatch name, never an old hex value (`updateCategory` refuses those).
    const fields = { name, emoji: draft.emoji, color: swatchFor(draft.color) };
    try {
      if (mode.kind === "add") await actions.addCategory(fields);
      else await actions.updateCategory(mode.category.id, fields);
    } catch (err) {
      console.error("saving a category failed:", err);
      setBusy(false);
      setError(navigator.onLine ? "Couldn't save this. Try again in a moment." : NET_ERROR);
      return;
    }
    const done = savedMessage(mode, name);
    toast(done);
    announce(done);
    onClose();
  }

  const title = changing ? "Change category" : "Add a category";
  const preview = { emoji: draft.emoji || "·", name: draft.name.trim() || "Category name", color: draft.color };

  return (
    <>
      <Sheet label={title} onClose={onClose} busy={busy}>
        <SheetHead title={title} />
        <SheetBody>
          <div ref={body} className={styles.fields}>
            {changing ? <p className={styles.formNote}>Changes show on every spend in this category.</p> : null}

            <div className={styles.preview} aria-hidden="true">
              <CategoryDisc big emoji={preview.emoji} color={preview.color} />
              <div className={styles.previewRight}>
                <Pill category={preview} />
                <span className={styles.bar}>
                  <i style={{ background: swatchSolid(draft.color) }} />
                </span>
              </div>
            </div>

            <TextField
              label="Name"
              name="name"
              value={draft.name}
              maxLength={40}
              readOnly={busy}
              error={errorFor("name")}
              data-autofocus={changing ? undefined : ""}
              onChange={(e) => set({ name: e.target.value })}
              onBlur={() => touch("name")}
            />

            <div className={styles.group}>
              <span className={styles.groupLabel} id="category-emoji">
                Emoji
              </span>
              <div className={styles.emoji} role="group" aria-labelledby="category-emoji">
                {SUGGESTED_EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={styles.emo}
                    aria-pressed={draft.emoji === emoji}
                    aria-label={`Emoji ${emoji}`}
                    disabled={busy}
                    onClick={() => set({ emoji })}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <TextField
                className={styles.own}
                label="Or type or paste your own"
                name="emoji"
                value={(SUGGESTED_EMOJI as readonly string[]).includes(draft.emoji) ? "" : draft.emoji}
                placeholder="🙂"
                readOnly={busy}
                error={errorFor("emoji")}
                onChange={(e) => {
                  set({ emoji: firstGrapheme(e.target.value) });
                  touch("emoji");
                }}
              />
            </div>

            <div className={styles.group}>
              <span className={styles.groupLabel} id="category-colour">
                Colour
              </span>
              <div className={styles.swatches} role="radiogroup" aria-labelledby="category-colour">
                {SWATCH_NAMES.map((name) => {
                  const on = draft.color === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={swatchLabel(name)}
                      className={styles.swatch}
                      style={{ background: swatchTint(name), borderColor: swatchSolid(name) }}
                      disabled={busy}
                      onClick={() => set({ color: name })}
                    >
                      {on ? <Icon name="check" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {changing && !busy && categories.length > 1 ? (
              <div className={styles.deleteZone}>
                <Button variant="dangerOutline" onClick={() => setDeleting(true)}>
                  <Icon name="trash" />
                  Delete this category
                </Button>
              </div>
            ) : null}
          </div>
        </SheetBody>
        <SheetFoot>
          {error ? <FieldError net>{error}</FieldError> : null}
          {summaryLine(keys) ? <FieldSummary>{summaryLine(keys)}</FieldSummary> : null}
          <SheetButtons>
            <Button size="big" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button size="big" variant="solid" notReady={keys.length > 0} busy={busy} busyLabel="Saving…" onClick={submit}>
              {changing ? "Save changes" : "Add category"}
            </Button>
          </SheetButtons>
        </SheetFoot>
      </Sheet>

      {deleting && changing ? (
        <DeleteCategoryDialog
          category={mode.category}
          others={categories.filter((c) => c.id !== mode.category.id)}
          actions={actions}
          onCancel={() => setDeleting(false)}
          onDeleted={onClose}
        />
      ) : null}
    </>
  );
}
