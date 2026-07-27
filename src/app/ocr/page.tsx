"use client";

import { useRef, useState } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import OcrReviewRow from "@/components/OcrReviewRow";

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [prefix, data] = result.split(",");
      const mediaType = prefix.match(/data:(.*);base64/)?.[1] ?? file.type;
      resolve({ data, mediaType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function OcrPage() {
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useTransactions();
  const { categories } = useCategories();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = transactions
    .filter((t) => t.status === "pending_review")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const { data, mediaType } = await fileToBase64(file);
        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: data, mediaType }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "OCR extraction failed");
        }
        const { transactions: extracted } = await res.json();
        for (const t of extracted) {
          await addTransaction({
            amount: Number(t.amount) || 0,
            store: t.store ?? "",
            description: t.description ?? "",
            categoryId: categories[0]?.id ?? "",
            date: t.date ?? new Date().toISOString().slice(0, 10),
            source: "ocr",
            status: "pending_review",
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">OCR Import</h1>

      <label className="block rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center cursor-pointer active:scale-[0.99] transition-transform">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
        <div className="text-3xl mb-2">📸</div>
        <div className="text-slate-600 font-medium">
          {uploading ? "Extracting transactions…" : "Upload BCA screenshots"}
        </div>
        <div className="text-slate-400 text-sm mt-1">Tap to select one or more images</div>
      </label>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 text-red-600 text-sm px-4 py-3">{error}</div>
      )}

      {pending.length > 0 && (
        <div className="mt-8 space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Review Queue ({pending.length})
          </h2>
          {pending.map((t) => (
            <OcrReviewRow
              key={t.id}
              transaction={t}
              categories={categories}
              onUpdate={(input) => updateTransaction(t.id, input)}
              onConfirm={() => updateTransaction(t.id, { status: "confirmed" })}
              onDelete={() => deleteTransaction(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
