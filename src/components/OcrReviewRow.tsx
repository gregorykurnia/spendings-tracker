"use client";

import { useState } from "react";
import { Category, Transaction } from "@/types";

export default function OcrReviewRow({
  transaction,
  categories,
  onUpdate,
  onConfirm,
  onDelete,
}: {
  transaction: Transaction;
  categories: Category[];
  onUpdate: (input: Partial<Omit<Transaction, "id">>) => Promise<void>;
  onConfirm: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(transaction.amount));
  const [store, setStore] = useState(transaction.store);
  const [description, setDescription] = useState(transaction.description);
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [date, setDate] = useState(transaction.date);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const valid = amount.trim() !== "" && Number(amount) > 0 && store.trim() && categoryId && date;

  function commit(field: keyof Transaction, value: string | number) {
    onUpdate({ [field]: value });
  }

  async function handleConfirm() {
    if (!valid) return;
    setConfirming(true);
    try {
      await onUpdate({
        amount: Number(amount),
        store: store.trim(),
        description: description.trim(),
        categoryId,
        date,
      });
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Amount (IDR)</label>
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => amount.trim() !== "" && Number(amount) > 0 && commit("amount", Number(amount))}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              commit("date", e.target.value);
            }}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500">Store</label>
        <input
          value={store}
          onChange={(e) => setStore(e.target.value)}
          onBlur={() => store.trim() && commit("store", store.trim())}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder="Merchant or transfer name"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => commit("description", description.trim())}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder="Optional note"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500">Category</label>
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            commit("categoryId", e.target.value);
          }}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleDelete}
          disabled={deleting || confirming}
          className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-500 disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
        <button
          onClick={handleConfirm}
          disabled={confirming || deleting || !valid}
          className="flex-[2] rounded-xl bg-emerald-500 text-white py-2.5 text-sm font-medium disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {confirming ? "Confirming…" : "Confirm"}
        </button>
      </div>
    </div>
  );
}
