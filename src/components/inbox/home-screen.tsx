"use client";

import { useState } from "react";
import { AppBar } from "@/components/app/app-bar";
import { ScreenSkeleton } from "@/components/app/screen-skeletons";
import { SpendForm } from "@/components/spend-form/spend-form";
import type { SpendFormMode } from "@/components/spend-form/rules";
import { useCategories } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import type { Transaction } from "@/types";
import { Inbox } from "./inbox";
import styles from "./inbox.module.css";

type FormTarget =
  | { kind: "add" }
  | { kind: "correct"; line: Transaction; focus?: "store" | "amount" | "date" };

/** Home: the inbox, with the spend form opening over it to correct a line or type one in. */
export function HomeScreen() {
  const { waiting, spends, loading, saveError, ...tx } = useTransactions();
  const { categories, loading: loadingCategories } = useCategories();
  const [form, setForm] = useState<FormTarget | null>(null);
  // The line the last edit was made on: a failed save is shown beside it.
  const [editedId, setEditedId] = useState<string | null>(null);

  const actions = {
    ...tx,
    editWaitingLine(id: string, patch: Parameters<typeof tx.editWaitingLine>[1]) {
      setEditedId(id);
      tx.editWaitingLine(id, patch);
    },
  };

  // The form edits the live line. Once it is accepted from the form the data drops it, and the form
  // goes on showing the line it opened with until it closes itself.
  const mode: SpendFormMode | null =
    form === null
      ? null
      : form.kind === "add"
        ? { kind: "add" }
        : {
            kind: "correct",
            line: waiting.find((line) => line.id === form.line.id) ?? form.line,
            focus: form.focus,
          };

  // The app's gate has the data already, but this screen's own listeners start empty for a moment:
  // without this it would show "All checked", or every line needing a category, before they fill.
  if (loading || loadingCategories) return <ScreenSkeleton screen="home" />;

  return (
    <>
      <AppBar onTypeInSpend={() => setForm({ kind: "add" })} />
      <main id="main" tabIndex={-1} className={styles.home}>
        <Inbox
          waiting={waiting}
          spends={spends}
          categories={categories}
          actions={actions}
          saveError={saveError}
          editedId={editedId}
          onCorrect={(line, focus) => setForm({ kind: "correct", line, focus })}
        />
      </main>
      {mode ? (
        <SpendForm mode={mode} categories={categories} actions={actions} onClose={() => setForm(null)} />
      ) : null}
    </>
  );
}
