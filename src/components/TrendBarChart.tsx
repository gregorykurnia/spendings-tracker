"use client";

import { useState } from "react";
import { formatIDR } from "@/lib/format";

export type TrendBucket = {
  key: string;
  label: string;
  value: number;
};

export default function TrendBarChart({ buckets }: { buckets: TrendBucket[] }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.value));

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-1 h-32">
        {buckets.map((b) => {
          const heightPct = (b.value / max) * 100;
          const isActive = active === b.key;
          return (
            <button
              type="button"
              key={b.key}
              onClick={() => setActive(isActive ? null : b.key)}
              className="flex-1 flex flex-col justify-end items-center h-full group"
            >
              {isActive && (
                <div className="mb-1 rounded-lg bg-slate-900 text-white text-[10px] px-1.5 py-0.5 whitespace-nowrap">
                  {formatIDR(b.value)}
                </div>
              )}
              <div
                className={`w-full rounded-t-md transition-colors ${
                  isActive ? "bg-emerald-500" : "bg-emerald-300 group-hover:bg-emerald-400"
                }`}
                style={{ height: `${Math.max(heightPct, b.value > 0 ? 3 : 0)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex gap-1">
        {buckets.map((b) => (
          <div
            key={b.key}
            className="flex-1 text-center text-[10px] text-slate-400 truncate"
          >
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}
