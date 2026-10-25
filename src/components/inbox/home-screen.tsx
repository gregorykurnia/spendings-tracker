"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { AppBar } from "@/components/app/app-bar";
import { ScreenSkeleton } from "@/components/app/screen-skeletons";
import { SpendForm } from "@/components/spend-form/spend-form";
import type { SpendFormMode } from "@/components/spend-form/rules";
import { useToast } from "@/components/ui/toast";
import { useCategories } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import { todayISO } from "@/lib/dates";
import type { Transaction } from "@/types";
import { AddButton } from "./add-button";
import { EmptyPanel } from "./empty-panel";
import { GlanceCard } from "./glance-card";
import { HomeLinks } from "./home-links";
import { ImportTray } from "./import-tray";
import { Inbox } from "./inbox";
import styles from "./inbox.module.css";
import { useImportTray } from "./use-import-tray";

type FormTarget =
  | { kind: "add" }
  | { kind: "correct"; line: Transaction; focus?: "store" | "amount" | "date" };

/**
 * Home: the glance card, the inbox with its import tray, and the links, with the spend form opening
 * over it to correct a line or type one in.
 */
export function HomeScreen() {
  const { waiting, spends, loading, saveError, ...tx } = useTransactions();
  const { categories, loading: loadingCategories } = useCategories();
  const { announce } = useToast();
  const [form, setForm] = useState<FormTarget | null>(null);
  // The line the last edit was made on: a failed save is shown beside it.
  const [editedId, setEditedId] = useState<string | null>(null);

  const picker = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const tray = useImportTray({
    save: (lines) => tx.addScreenshotLines(lines, categories),
    announce,
  });

  function chosen(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    tray.add(Array.from(input.files ?? []));
    // So choosing the same screenshot again is noticed.
    input.value = "";
  }

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

  const typeIn = () => setForm({ kind: "add" });
  // "From 2 screenshots, added just now": only while every waiting line came in this visit.
  const freshShots =
    waiting.length > 0 && waiting.every((line) => tray.fresh.stamps.has(line.createdAt)) ? tray.fresh.shots : 0;
  const trayShown = tray.shots.length > 0;
  const firstUse = !spends.length && !waiting.length && !trayShown;
  const openPicker = () => picker.current?.click();

  return (
    <>
      <AppBar onTypeInSpend={typeIn} />
      <main id="main" tabIndex={-1} className={styles.home}>
        {firstUse ? null : <GlanceCard spends={spends} today={todayISO()} />}
        <Inbox
          waiting={waiting}
          spends={spends}
          categories={categories}
          actions={actions}
          saveError={saveError}
          editedId={editedId}
          onCorrect={(line, focus) => setForm({ kind: "correct", line, focus })}
          firstUse={firstUse}
          freshShots={freshShots}
          headAction={<AddButton ref={addButton} short reading={tray.busy} onPress={openPicker} />}
          tray={
            trayShown ? (
              <ImportTray
                shots={tray.shots}
                onRetry={tray.retry}
                onDismiss={(n) => {
                  tray.dismiss(n);
                  addButton.current?.focus();
                }}
                onTypeIn={typeIn}
              />
            ) : null
          }
          emptyPanel={
            <EmptyPanel
              firstUse={firstUse}
              add={<AddButton big reading={tray.busy} onPress={openPicker} />}
              onTypeInSpend={typeIn}
            />
          }
        />
        <HomeLinks onTypeInSpend={typeIn} />
        <input
          ref={picker}
          type="file"
          accept="image/*"
          multiple
          hidden
          tabIndex={-1}
          aria-hidden="true"
          onChange={chosen}
        />
      </main>
      {mode ? (
        <SpendForm mode={mode} categories={categories} actions={actions} onClose={() => setForm(null)} />
      ) : null}
    </>
  );
}
