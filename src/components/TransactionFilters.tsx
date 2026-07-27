"use client";

import { Category } from "@/types";
import { Granularity, todayISO } from "@/lib/dateRanges";

export type DateMode = "period" | "custom" | "all";

export type Filters = {
  dateMode: DateMode;
  granularity: Granularity;
  anchor: string;
  customStart: string;
  customEnd: string;
  categoryIds: string[];
  source: "manual" | "ocr" | "all";
  minAmount: string;
  maxAmount: string;
  keyword: string;
};

export type SortOption = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

export function defaultFilters(): Filters {
  return {
    dateMode: "period",
    granularity: "month",
    anchor: todayISO(),
    customStart: "",
    customEnd: "",
    categoryIds: [],
    source: "all",
    minAmount: "",
    maxAmount: "",
    keyword: "",
  };
}

export default function TransactionFilters({
  filters,
  onChange,
  sort,
  onSortChange,
  categories,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  categories: Category[];
}) {
  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function toggleCategory(id: string) {
    const has = filters.categoryIds.includes(id);
    set(
      "categoryIds",
      has ? filters.categoryIds.filter((c) => c !== id) : [...filters.categoryIds, id]
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-600">Search</label>
        <input
          value={filters.keyword}
          onChange={(e) => set("keyword", e.target.value)}
          placeholder="Search store or description…"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-600">Date Range</label>
        <div className="flex gap-2">
          {(
            [
              { value: "period", label: "Day/Week/Month" },
              { value: "custom", label: "Custom" },
              { value: "all", label: "All Time" },
            ] as { value: DateMode; label: string }[]
          ).map((o) => (
            <button
              type="button"
              key={o.value}
              onClick={() => set("dateMode", o.value)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm border transition-colors ${
                filters.dateMode === o.value
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {filters.dateMode === "period" && (
          <p className="text-xs text-slate-400 pt-1">
            Use the arrows at the top of the page to step through days, weeks, or months.
          </p>
        )}
        {filters.dateMode === "custom" && (
          <div className="flex gap-2 pt-1">
            <input
              type="date"
              value={filters.customStart}
              onChange={(e) => set("customStart", e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <input
              type="date"
              value={filters.customEnd}
              onChange={(e) => set("customEnd", e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-600">Categories</label>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const active = filters.categoryIds.includes(c.id);
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => toggleCategory(c.id)}
                className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${
                  active
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                {c.emoji} {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-600">Source</label>
        <select
          value={filters.source}
          onChange={(e) => set("source", e.target.value as Filters["source"])}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <option value="all">All</option>
          <option value="manual">Manual</option>
          <option value="ocr">OCR</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-600">Min Amount</label>
          <input
            type="number"
            inputMode="numeric"
            value={filters.minAmount}
            onChange={(e) => set("minAmount", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-600">Max Amount</label>
          <input
            type="number"
            inputMode="numeric"
            value={filters.maxAmount}
            onChange={(e) => set("maxAmount", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-600">Sort</label>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <option value="date_desc">Date, newest first</option>
          <option value="date_asc">Date, oldest first</option>
          <option value="amount_desc">Amount, highest first</option>
          <option value="amount_asc">Amount, lowest first</option>
        </select>
      </div>

      <button
        type="button"
        onClick={() => onChange(defaultFilters())}
        className="w-full text-sm text-slate-400 hover:text-slate-600 py-1"
      >
        Reset filters
      </button>
    </div>
  );
}
