"use client";

import { useState } from "react";
import { useCategories } from "@/hooks/useCategories";
import { useTransactionCounts } from "@/hooks/useTransactionCounts";
import { Category } from "@/types";
import CategoryFormModal from "@/components/CategoryFormModal";
import DeleteCategoryModal from "@/components/DeleteCategoryModal";

export default function CategoriesPage() {
  const {
    categories,
    loading,
    error,
    addCategory,
    updateCategory,
    deleteCategory,
    transactionCountForCategory,
    reassignAndDelete,
    moveCategory,
  } = useCategories();
  const counts = useTransactionCounts();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteCount, setDeleteCount] = useState<number | null>(null);

  const sorted = [...categories].sort((a, b) => a.order - b.order);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setFormOpen(true);
  }

  async function handleSubmit(input: { name: string; emoji: string; color: string }) {
    if (editing) {
      await updateCategory(editing.id, input);
    } else {
      await addCategory(input);
    }
  }

  async function openDelete(category: Category) {
    setDeleteTarget(category);
    setDeleteCount(null);
    const count = await transactionCountForCategory(category.id);
    setDeleteCount(count);
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
        <button
          onClick={openAdd}
          className="rounded-full bg-emerald-500 text-white w-10 h-10 flex items-center justify-center text-xl shadow-sm active:scale-95 transition-transform"
          aria-label="Add category"
        >
          +
        </button>
      </div>

      {error ? (
        <div className="text-center text-red-500 py-16 px-4">
          Failed to load categories: {error}
        </div>
      ) : loading ? (
        <div className="text-center text-slate-400 py-16">Loading…</div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((category, i) => (
            <li
              key={category.id}
              className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-3"
            >
              <div
                className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-xl"
                style={{ backgroundColor: `${category.color}20` }}
              >
                {category.emoji}
              </div>

              <button
                onClick={() => openEdit(category)}
                className="flex-1 text-left min-w-0"
              >
                <div className="font-medium text-slate-900 truncate">{category.name}</div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {counts[category.id] ?? 0} transaction
                  {(counts[category.id] ?? 0) === 1 ? "" : "s"}
                </div>
              </button>

              <div className="flex flex-col">
                <button
                  onClick={() => moveCategory(category.id, "up")}
                  disabled={i === 0}
                  className="text-slate-300 disabled:opacity-30 hover:text-slate-600 leading-none px-1"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveCategory(category.id, "down")}
                  disabled={i === sorted.length - 1}
                  className="text-slate-300 disabled:opacity-30 hover:text-slate-600 leading-none px-1"
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>

              <button
                onClick={() => openDelete(category)}
                className="text-slate-300 hover:text-red-500 px-1"
                aria-label="Delete category"
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      )}

      <CategoryFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        initial={editing}
      />

      <DeleteCategoryModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        category={deleteTarget}
        otherCategories={sorted.filter((c) => c.id !== deleteTarget?.id)}
        transactionCount={deleteCount}
        onConfirmDelete={async () => {
          if (deleteTarget) await deleteCategory(deleteTarget.id);
        }}
        onReassignAndDelete={async (toCategoryId) => {
          if (deleteTarget) await reassignAndDelete(deleteTarget.id, toCategoryId);
        }}
      />
    </div>
  );
}
