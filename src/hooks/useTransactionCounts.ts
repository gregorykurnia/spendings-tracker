"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CategoryUsage } from "@/types";

/**
 * Spends and waiting lines per category ID, kept up to date. `counts` is empty until the first
 * answer (`loading`), and a failure is returned as `error` so a screen can say so instead of
 * showing "No spends yet". `retry` listens again.
 */
export function useTransactionCounts() {
  const [counts, setCounts] = useState<Record<string, CategoryUsage>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "transactions"),
      (snap) => {
        const next: Record<string, CategoryUsage> = {};
        snap.docs.forEach((d) => {
          const { categoryId, status } = d.data();
          if (!categoryId) return;
          const usage = (next[categoryId] ??= { spends: 0, waiting: 0 });
          if (status === "pending_review") usage.waiting++;
          else usage.spends++;
        });
        setCounts(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("counts onSnapshot failed:", err);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [attempt]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { counts, loading, error, retry };
}
