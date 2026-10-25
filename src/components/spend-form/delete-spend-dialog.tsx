"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { CategoryDisc } from "@/components/ui/pill";
import { Sheet, SheetBody, SheetButtons, SheetFoot, SheetHead } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useOnline } from "@/hooks/useOnline";
import { formatDay, todayISO } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { NET_ERROR } from "@/lib/offline";
import type { Category, Transaction } from "@/types";
import styles from "./delete-spend-dialog.module.css";

type Props = {
  spend: Transaction;
  /** The spend's category, or `undefined` when it was removed. */
  category: Category | undefined;
  deleteTransaction: (id: string) => Promise<void>;
  /** "Cancel": back to where the question was asked. */
  onCancel: () => void;
  /** The spend is gone. */
  onDeleted: () => void;
};

/** The one question before a spend is removed for good: safe button first, then "Delete". */
export function DeleteSpendDialog({ spend, category, deleteTransaction, onCancel, onDeleted }: Props) {
  const online = useOnline();
  const { toast, announce } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (busy) return;
    if (!online) {
      setError(NET_ERROR);
      announce(NET_ERROR);
      return;
    }
    setError("");
    setBusy(true);
    try {
      await deleteTransaction(spend.id);
    } catch (err) {
      console.error("deleting a spend failed:", err);
      setBusy(false);
      setError(
        navigator.onLine ? "Couldn't delete this spend. Try again in a moment." : NET_ERROR
      );
      return;
    }
    toast(`Deleted ${spend.store}, ${formatRupiah(spend.amount)}.`);
    announce(`Deleted ${spend.store}.`);
    onDeleted();
  }

  return (
    <Sheet label="Delete this spend?" role="alertdialog" onClose={onCancel} busy={busy}>
      <SheetHead title="Delete this spend?" />
      <SheetBody>
        <div className={styles.card}>
          <CategoryDisc emoji={category?.emoji ?? "❔"} color={category?.color ?? "slate"} />
          <span className={styles.main}>
            <span className={styles.store}>{spend.store}</span>
            <span className={styles.sub}>{formatDay(spend.date, todayISO())}</span>
          </span>
          <b>{formatRupiah(spend.amount)}</b>
        </div>
        <p className={styles.note}>It is removed for good and stops counting in your totals.</p>
        {error ? <FieldError net>{error}</FieldError> : null}
      </SheetBody>
      <SheetFoot>
        <SheetButtons>
          <Button size="big" disabled={busy} onClick={onCancel} data-autofocus={busy ? undefined : ""}>
            Cancel
          </Button>
          <Button size="big" variant="danger" busy={busy} busyLabel="Deleting…" onClick={remove}>
            Delete
          </Button>
        </SheetButtons>
      </SheetFoot>
    </Sheet>
  );
}
