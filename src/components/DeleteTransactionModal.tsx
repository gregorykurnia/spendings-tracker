"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { Transaction } from "@/types";
import { formatIDR } from "@/lib/format";

export default function DeleteTransactionModal({
  open,
  onClose,
  transaction,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  if (!transaction) return null;

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Delete Transaction">
      <div className="space-y-5">
        <p className="text-slate-600">
          Delete{" "}
          <span className="font-medium text-slate-900">
            {transaction.description} ({formatIDR(transaction.amount)})
          </span>
          ? This can&apos;t be undone.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-3 font-medium text-slate-600"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="flex-1 rounded-xl bg-red-500 text-white font-medium py-3 disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
