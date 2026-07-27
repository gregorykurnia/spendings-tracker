"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { Category } from "@/types";

const PRESET_COLORS = [
  "#f97316", "#84cc16", "#3b82f6", "#0ea5e9", "#64748b",
  "#ef4444", "#ec4899", "#a855f7", "#eab308", "#22c55e",
  "#6366f1", "#06b6d4", "#f43f5e", "#78716c", "#9ca3af",
];

export default function CategoryFormModal({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; emoji: string; color: string }) => Promise<void>;
  initial?: Category | null;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("❓");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setEmoji(initial?.emoji ?? "❓");
      setColor(initial?.color ?? PRESET_COLORS[0]);
    }
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), emoji, color });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit Category" : "New Category"}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex gap-3 items-center">
          <div
            className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${color}20` }}
          >
            {emoji}
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium text-slate-600">Emoji</label>
            <input
              value={emoji}
              onChange={(e) =>
                setEmoji(Array.from(e.target.value).slice(0, 4).join(""))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="🍽️"
              autoFocus
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-600">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="Category name"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-600">Color</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-transform ${
                  color === c ? "ring-2 ring-offset-2 ring-slate-900 scale-105" : ""
                }`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full rounded-xl bg-emerald-500 text-white font-medium py-3 disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {saving ? "Saving…" : initial ? "Save Changes" : "Add Category"}
        </button>
      </form>
    </Modal>
  );
}
