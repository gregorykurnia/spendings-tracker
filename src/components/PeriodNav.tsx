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
  onGranularityChange,
  onAnchorChange,
}: {
  granularity: Granularity;
  anchor: string;
  onGranularityChange: (g: Granularity) => void;
  onAnchorChange: (anchor: string) => void;
}) {
  function shift(dir: -1 | 1) {
    onAnchorChange(shiftAnchor(granularity, anchor, dir));
  }

  function changeGranularity(g: Granularity) {
    if (g === granularity) return;
    onGranularityChange(g);
    onAnchorChange(todayISO());
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-3 space-y-3">
      <div className="flex gap-2">
        {GRANULARITIES.map((g) => (
          <button
            key={g.value}
            type="button"
            onClick={() => changeGranularity(g.value)}
            className={`flex-1 rounded-xl px-2 py-1.5 text-sm font-medium transition-colors ${
              granularity === g.value
                ? "bg-emerald-500 text-white"
                : "bg-slate-50 text-slate-500"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Previous period"
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 active:scale-95 transition-transform hover:bg-slate-50"
        >
          ‹
        </button>
        <div className="font-semibold text-slate-900 text-center">
          {formatPeriodLabel(granularity, anchor)}
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next period"
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 active:scale-95 transition-transform hover:bg-slate-50"
        >
          ›
        </button>
      </div>
    </div>
  );
}
