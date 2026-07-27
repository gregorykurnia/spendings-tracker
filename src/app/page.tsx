"use client";

import { useMemo, useState } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { resolveDateRange, resolveComparisonRange, DateRangeOption } from "@/lib/dateRanges";
import { formatIDR } from "@/lib/format";
import { colorForIndex } from "@/lib/categoricalPalette";
import CategoryDonutChart from "@/components/CategoryDonutChart";
import TrendBarChart, { TrendBucket } from "@/components/TrendBarChart";

const TIMEFRAMES: { value: DateRangeOption; label: string }[] = [
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "this_year", label: "This Year" },
];

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildDailyBuckets(start: string, end: string): TrendBucket[] {
  const buckets: TrendBucket[] = [];
  const cur = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  while (cur <= endDate) {
    buckets.push({
      key: toISO(cur),
      label: cur.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      value: 0,
    });
    cur.setDate(cur.getDate() + 1);
  }
  return buckets;
}

function buildWeeklyBuckets(start: string, end: string): TrendBucket[] {
  const buckets: TrendBucket[] = [];
  const cur = new Date(`${start}T00:00:00`);
  const day = cur.getDay();
  cur.setDate(cur.getDate() - ((day + 6) % 7));
  const endDate = new Date(`${end}T00:00:00`);
  while (cur <= endDate) {
    buckets.push({
      key: toISO(cur),
      label: cur.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      value: 0,
    });
    cur.setDate(cur.getDate() + 7);
  }
  return buckets;
}

function bucketKeyForDate(
  dateStr: string,
  granularity: "day" | "week",
  buckets: TrendBucket[]
): string | undefined {
  if (granularity === "day") return dateStr;
  const d = new Date(`${dateStr}T00:00:00`);
  for (const b of buckets) {
    const bStart = new Date(`${b.key}T00:00:00`);
    const bEnd = new Date(bStart);
    bEnd.setDate(bEnd.getDate() + 6);
    if (d >= bStart && d <= bEnd) return b.key;
  }
  return undefined;
}

export default function Home() {
  const { transactions, loading: txLoading } = useTransactions();
  const { categories, loading: catLoading } = useCategories();
  const [timeframe, setTimeframe] = useState<DateRangeOption>("this_month");

  const range = useMemo(() => resolveDateRange(timeframe), [timeframe]);

  const periodTransactions = useMemo(() => {
    const confirmed = transactions.filter((t) => t.status === "confirmed");
    if (!range) return confirmed;
    return confirmed.filter((t) => t.date >= range.start && t.date <= range.end);
  }, [transactions, range]);

  const total = useMemo(
    () => periodTransactions.reduce((sum, t) => sum + t.amount, 0),
    [periodTransactions]
  );

  const comparisonRange = useMemo(() => resolveComparisonRange(timeframe), [timeframe]);

  const comparisonTotal = useMemo(() => {
    if (!comparisonRange) return null;
    const confirmed = transactions.filter((t) => t.status === "confirmed");
    return confirmed
      .filter((t) => t.date >= comparisonRange.start && t.date <= comparisonRange.end)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, comparisonRange]);

  const comparisonDeltaPct =
    comparisonTotal !== null && comparisonTotal > 0
      ? ((total - comparisonTotal) / comparisonTotal) * 100
      : null;

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const colorIndexById = useMemo(() => {
    const sorted = [...categories].sort((a, b) => a.order - b.order);
    return new Map(sorted.map((c, idx) => [c.id, idx]));
  }, [categories]);

  const breakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of periodTransactions) {
      totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
    }
    return [...totals.entries()]
      .map(([id, value]) => {
        const category = categoryById.get(id);
        return {
          id,
          label: category ? `${category.emoji} ${category.name}` : "Unknown",
          value,
          color: colorForIndex(colorIndexById.get(id) ?? 0),
          pct: total > 0 ? (value / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [periodTransactions, categoryById, colorIndexById, total]);

  const granularity: "day" | "week" =
    timeframe === "last_3_months" || timeframe === "this_year" ? "week" : "day";

  const trendBuckets = useMemo(() => {
    if (!range) return [];
    const buckets =
      granularity === "day"
        ? buildDailyBuckets(range.start, range.end)
        : buildWeeklyBuckets(range.start, range.end);
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const t of periodTransactions) {
      const key = bucketKeyForDate(t.date, granularity, buckets);
      const bucket = key ? byKey.get(key) : undefined;
      if (bucket) bucket.value += t.amount;
    }
    return buckets;
  }, [range, granularity, periodTransactions]);

  const topTransactions = useMemo(
    () => [...periodTransactions].sort((a, b) => b.amount - a.amount).slice(0, 5),
    [periodTransactions]
  );

  const loading = txLoading || catLoading;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            type="button"
            onClick={() => setTimeframe(tf.value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm border transition-colors ${
              timeframe === tf.value
                ? "bg-emerald-500 text-white border-emerald-500"
                : "border-slate-200 text-slate-600"
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
          Loading…
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">Total spent</div>
            <div className="text-3xl font-bold text-slate-900 mt-1">{formatIDR(total)}</div>
            {comparisonRange && comparisonTotal !== null && (
              <div
                className={`mt-1 text-sm ${
                  comparisonDeltaPct === null
                    ? "text-slate-400"
                    : comparisonDeltaPct > 0
                    ? "text-rose-600"
                    : comparisonDeltaPct < 0
                    ? "text-emerald-600"
                    : "text-slate-400"
                }`}
              >
                {comparisonDeltaPct === null
                  ? `No spending ${comparisonRange.label} to compare`
                  : `${comparisonDeltaPct > 0 ? "▲" : comparisonDeltaPct < 0 ? "▼" : "–"} ${Math.abs(
                      comparisonDeltaPct
                    ).toFixed(0)}% vs ${comparisonRange.label} (${formatIDR(comparisonTotal)})`}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Category breakdown</h2>
            {breakdown.length === 0 ? (
              <p className="text-sm text-slate-400">No transactions in this period.</p>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <CategoryDonutChart segments={breakdown} total={total} />
                  <div className="flex-1 space-y-2 min-w-0">
                    {breakdown.map((b) => (
                      <div key={b.id} className="flex items-center gap-2 text-sm">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: b.color }}
                        />
                        <span className="flex-1 truncate text-slate-700">{b.label}</span>
                        <span className="font-medium text-slate-900 shrink-0">
                          {formatIDR(b.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Spending trend ({granularity === "day" ? "daily" : "weekly"})
            </h2>
            {trendBuckets.length === 0 ? (
              <p className="text-sm text-slate-400">No data.</p>
            ) : (
              <TrendBarChart buckets={trendBuckets} />
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Top 5 transactions</h2>
            {topTransactions.length === 0 ? (
              <p className="text-sm text-slate-400">No transactions in this period.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {topTransactions.map((t) => {
                  const category = categoryById.get(t.categoryId);
                  return (
                    <li key={t.id} className="py-2 flex items-center gap-3">
                      <span className="text-xl">{category?.emoji ?? "❓"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {t.store || "—"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {t.date} · {category?.name ?? "Uncategorized"}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 shrink-0">
                        {formatIDR(t.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
