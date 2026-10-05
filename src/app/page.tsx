"use client";

import { useMemo, useState } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { formatPeriodLabel, getPeriodRange, shiftAnchor, todayISO } from "@/lib/dateRanges";
import { formatIDR } from "@/lib/format";
import { colorForIndex } from "@/lib/categoricalPalette";
import CategoryDonutChart from "@/components/CategoryDonutChart";
import TrendBarChart, { TrendBucket } from "@/components/TrendBarChart";
import PeriodNav from "@/components/PeriodNav";

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
      rangeLabel: cur.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      value: 0,
    });
    cur.setDate(cur.getDate() + 1);
  }
  return buckets;
}

export default function Home() {
  const { transactions, loading: txLoading } = useTransactions();
  const { categories, loading: catLoading } = useCategories();
  const [granularity, setGranularity] = useState<"month" | "week">("month");
  const [periodAnchor, setPeriodAnchor] = useState(todayISO());

  const range = useMemo(
    () => getPeriodRange(granularity, periodAnchor),
    [granularity, periodAnchor]
  );

  const periodTransactions = useMemo(() => {
    const confirmed = transactions.filter((t) => t.status === "confirmed");
    if (!range) return confirmed;
    return confirmed.filter((t) => t.date >= range.start && t.date <= range.end);
  }, [transactions, range]);

  const total = useMemo(
    () => periodTransactions.reduce((sum, t) => sum + t.amount, 0),
    [periodTransactions]
  );

  const comparisonRange = useMemo(() => {
    const previousPeriodAnchor = shiftAnchor(granularity, periodAnchor, -1);
    const previousPeriodRange = getPeriodRange(granularity, previousPeriodAnchor);
    return {
      ...previousPeriodRange,
      label: formatPeriodLabel(granularity, previousPeriodAnchor).toLowerCase(),
    };
  }, [granularity, periodAnchor]);

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

  const trendBuckets = useMemo(() => {
    const buckets = buildDailyBuckets(range.start, range.end);
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const t of periodTransactions) {
      const bucket = byKey.get(t.date);
      if (bucket) bucket.value += t.amount;
    }
    return buckets;
  }, [range, periodTransactions]);

  const topTransactions = useMemo(
    () => [...periodTransactions].sort((a, b) => b.amount - a.amount).slice(0, 5),
    [periodTransactions]
  );

  const loading = txLoading || catLoading;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
          View spending by
        </p>
        <PeriodNav
          granularity={granularity}
          anchor={periodAnchor}
          granularities={["month", "week"]}
          preserveAnchorOnGranularityChange
          onChange={({ granularity: nextGranularity, anchor }) => {
            if (nextGranularity === "month" || nextGranularity === "week") {
              setGranularity(nextGranularity);
              setPeriodAnchor(anchor);
            }
          }}
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
          Loading…
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-500">
              Total spent in {formatPeriodLabel(granularity, periodAnchor)}
            </div>
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
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Spending trend (daily)</h2>
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
