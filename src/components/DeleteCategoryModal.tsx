"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { Category } from "@/types";

export default function DeleteCategoryModal({
  open,
  onClose,
  category,
  otherCategories,
  transactionCount,
  onConfirmDelete,
  onReassignAndDelete,
}: {
  open: boolean;
  onClose: () => void;
  category: Category | null;
  otherCategories: Category[];
  transactionCount: number | null;
  onConfirmDelete: () => Promise<void>;
  onReassignAndDelete: (toCategoryId: string) => Promise<void>;
}) {
  const [reassignTo, setReassignTo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setReassignTo(otherCategories[0]?.id ?? "");
  }, [open, otherCategories]);

  if (!category) return null;

  const hasTransactions = (transactionCount ?? 0) > 0;

  async function handleConfirm() {
    setBusy(true);
    try {
      if (hasTransactions) {
        if (!reassignTo) return;
        await onReassignAndDelete(reassignTo);
      } else {
        await onConfirmDelete();
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Delete Category">
      <div className="space-y-5">
        <p className="text-slate-600">
          {transactionCount === null ? (
            "Checking transactions…"
          ) : hasTransactions ? (
            <>
              <span className="font-medium text-slate-900">
                {category.emoji} {category.name}
              </span>{" "}
              has {transactionCount} transaction{transactionCount === 1 ? "" : "s"}.
              Reassign them to another category before deleting.
            </>
          ) : (
            <>
              Delete{" "}
              <span className="font-medium text-slate-900">
                {category.emoji} {category.name}
              </span>
              ? This can&apos;t be undone.
            </>
          )}
        </p>

        {hasTransactions && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Reassign to</label>
            <select
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              {otherCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-3 font-medium text-slate-600"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy || transactionCount === null || (hasTransactions && !reassignTo)}
            className="flex-1 rounded-xl bg-red-500 text-white font-medium py-3 disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {busy ? "Deleting…" : hasTransactions ? "Reassign & Delete" : "Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
