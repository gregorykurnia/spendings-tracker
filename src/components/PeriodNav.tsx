"use client";

import { Granularity, formatPeriodLabel, shiftAnchor, todayISO } from "@/lib/dateRanges";

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export default function PeriodNav({
  granularity,
  anchor,
  onChange,
  granularities = GRANULARITIES.map((g) => g.value),
  preserveAnchorOnGranularityChange = false,
}: {
  granularity: Granularity;
  anchor: string;
  onChange: (next: { granularity: Granularity; anchor: string }) => void;
  granularities?: Granularity[];
  preserveAnchorOnGranularityChange?: boolean;
}) {
  function shift(dir: -1 | 1) {
    onChange({ granularity, anchor: shiftAnchor(granularity, anchor, dir) });
  }

  function changeGranularity(g: Granularity) {
    if (g === granularity) return;
    onChange({
      granularity: g,
      anchor: preserveAnchorOnGranularityChange ? anchor : todayISO(),
    });
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-3 space-y-3">
      <div className="flex gap-2">
        {granularities.map((value) => {
          const option = GRANULARITIES.find((g) => g.value === value);
          if (!option) return null;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => changeGranularity(option.value)}
              aria-pressed={granularity === option.value}
              className={`flex-1 rounded-xl px-2 py-1.5 text-sm font-medium transition-colors ${
                granularity === option.value
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-50 text-slate-500"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label={`Previous ${granularity}`}
          title={`Previous ${granularity}`}
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 active:scale-95 transition-transform hover:bg-slate-50"
        >
          ‹
        </button>
        <div className="font-semibold text-slate-900 text-center" aria-live="polite">
          {formatPeriodLabel(granularity, anchor)}
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label={`Next ${granularity}`}
          title={`Next ${granularity}`}
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 active:scale-95 transition-transform hover:bg-slate-50"
        >
          ›
        </button>
      </div>
    </div>
  );
}
