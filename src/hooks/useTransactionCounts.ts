"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CategoryUsage } from "@/types";

/** Spends and waiting lines per category ID, kept up to date. */
export function useTransactionCounts() {
  const [counts, setCounts] = useState<Record<string, CategoryUsage>>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "transactions"), (snap) => {
      const next: Record<string, CategoryUsage> = {};
      snap.docs.forEach((d) => {
        const { categoryId, status } = d.data();
        if (!categoryId) return;
        const usage = (next[categoryId] ??= { spends: 0, waiting: 0 });
        if (status === "pending_review") usage.waiting++;
        else usage.spends++;
      });
      setCounts(next);
    });
    return () => unsubscribe();
  }, []);

  return counts;
}
