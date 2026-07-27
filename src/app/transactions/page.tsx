"use client";

import { useMemo, useState } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { Transaction } from "@/types";
import { formatIDR } from "@/lib/format";
import { getPeriodRange } from "@/lib/dateRanges";
import Modal from "@/components/Modal";
import PeriodNav from "@/components/PeriodNav";
import TransactionFilters, {
  defaultFilters,
  Filters,
  SortOption,
} from "@/components/TransactionFilters";
import TransactionFormModal, { TransactionInput } from "@/components/TransactionFormModal";
import DeleteTransactionModal from "@/components/DeleteTransactionModal";

export default function TransactionsPage() {
  const { transactions, loading, error, addTransaction, updateTransaction, deleteTransaction } =
    useTransactions();
  const { categories } = useCategories();

  const [filters, setFilters] = useState<Filters>(defaultFilters());
  const [sort, setSort] = useState<SortOption>("date_desc");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const categoryById = useMemo(() => {
    const map: Record<string, (typeof categories)[number]> = {};
    categories.forEach((c) => (map[c.id] = c));
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    const range =
      filters.dateMode === "period"
        ? getPeriodRange(filters.granularity, filters.anchor)
        : filters.dateMode === "custom" && filters.customStart && filters.customEnd
          ? { start: filters.customStart, end: filters.customEnd }
          : null;
    const keyword = filters.keyword.trim().toLowerCase();
    const min = filters.minAmount ? Number(filters.minAmount) : null;
    const max = filters.maxAmount ? Number(filters.maxAmount) : null;

    let result = transactions.filter((t) => {
      if (range && (t.date < range.start || t.date > range.end)) return false;
      if (filters.categoryIds.length && !filters.categoryIds.includes(t.categoryId)) return false;
      if (filters.source !== "all" && t.source !== filters.source) return false;
      if (min !== null && t.amount < min) return false;
      if (max !== null && t.amount > max) return false;
      if (
        keyword &&
        !t.store.toLowerCase().includes(keyword) &&
        !t.description.toLowerCase().includes(keyword)
      )
        return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      switch (sort) {
        case "date_asc":
          return a.date.localeCompare(b.date);
        case "amount_desc":
          return b.amount - a.amount;
        case "amount_asc":
          return a.amount - b.amount;
        case "date_desc":
        default:
          return b.date.localeCompare(a.date);
      }
    });

    return result;
  }, [transactions, filters, sort]);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(t: Transaction) {
    setEditing(t);
    setFormOpen(true);
  }

  async function handleSubmit(input: TransactionInput) {
    if (editing) {
      await updateTransaction(editing.id, input);
    } else {
      await addTransaction({ ...input, source: "manual", status: "confirmed" });
    }
  }

  const activeFilterCount =
    filters.categoryIds.length +
    (filters.source !== "all" ? 1 : 0) +
    (filters.minAmount ? 1 : 0) +
    (filters.maxAmount ? 1 : 0) +
    (filters.keyword ? 1 : 0);

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltersOpen(true)}
            className="relative rounded-full border border-slate-200 w-10 h-10 flex items-center justify-center text-lg active:scale-95 transition-transform"
            aria-label="Filters"
          >
            ⚙️
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={openAdd}
            className="rounded-full bg-emerald-500 text-white w-10 h-10 flex items-center justify-center text-xl shadow-sm active:scale-95 transition-transform"
            aria-label="Add transaction"
          >
            +
          </button>
        </div>
      </div>

      {filters.dateMode === "period" && (
        <div className="mb-4">
          <PeriodNav
            granularity={filters.granularity}
            anchor={filters.anchor}
            onChange={({ granularity, anchor }) =>
              setFilters((f) => ({ ...f, granularity, anchor }))
            }
          />
        </div>
      )}

      {error ? (
        <div className="text-center text-red-500 py-16 px-4">
          Failed to load transactions: {error}
        </div>
      ) : loading ? (
        <div className="text-center text-slate-400 py-16">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
          No transactions found.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => {
            const category = categoryById[t.categoryId];
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-3"
              >
                <div
                  className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-xl"
                  style={{ backgroundColor: `${category?.color ?? "#9ca3af"}20` }}
                >
                  {category?.emoji ?? "❓"}
                </div>

                <button onClick={() => openEdit(t)} className="flex-1 text-left min-w-0">
                  <div className="font-medium text-slate-900 truncate">{t.store}</div>
                  {t.description && (
                    <div className="text-xs text-slate-500 truncate">{t.description}</div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span>{t.date}</span>
                    <span>·</span>
                    <span>{category?.name ?? "Uncategorized"}</span>
                    {t.source === "ocr" && (
                      <>
                        <span>·</span>
                        <span>📸 OCR</span>
                      </>
                    )}
                  </div>
                </button>

                <div className="font-semibold text-slate-900">{formatIDR(t.amount)}</div>

                <button
                  onClick={() => setDeleteTarget(t)}
                  className="text-slate-300 hover:text-red-500 px-1"
                  aria-label="Delete transaction"
                >
                  🗑️
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <TransactionFilters
          filters={filters}
          onChange={setFilters}
          sort={sort}
          onSortChange={setSort}
          categories={categories}
        />
      </Modal>

      <TransactionFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        initial={editing}
        categories={categories}
      />

      <DeleteTransactionModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        transaction={deleteTarget}
        onConfirm={async () => {
          if (deleteTarget) await deleteTransaction(deleteTarget.id);
        }}
      />
    </div>
  );
}
