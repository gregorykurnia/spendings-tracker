"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { Category, Transaction } from "@/types";

export type TransactionInput = {
  amount: number;
  description: string;
  categoryId: string;
  date: string;
  type: "expense" | "income";
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TransactionFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: TransactionInput) => Promise<void>;
  initial?: Transaction | null;
  categories: Category[];
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState<"expense" | "income">("expense");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(initial ? String(initial.amount) : "");
      setDescription(initial?.description ?? "");
      setCategoryId(initial?.categoryId ?? categories[0]?.id ?? "");
      setDate(initial?.date ?? todayISO());
      setType(initial?.type ?? "expense");
    }
  }, [open, initial, categories]);

  const valid = amount.trim() !== "" && Number(amount) > 0 && description.trim() && categoryId && date;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      await onSubmit({
        amount: Number(amount),
        description: description.trim(),
        categoryId,
        date,
        type,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit Transaction" : "New Transaction"}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex rounded-xl border border-slate-200 p-1">
          {(["expense", "income"] as const).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors ${
                type === t ? "bg-emerald-500 text-white" : "text-slate-500"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-600">Amount (IDR)</label>
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="50000"
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-600">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="Merchant or transfer name"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-600">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-600">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !valid}
          className="w-full rounded-xl bg-emerald-500 text-white font-medium py-3 disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {saving ? "Saving…" : initial ? "Save Changes" : "Add Transaction"}
        </button>
      </form>
    </Modal>
  );
}
