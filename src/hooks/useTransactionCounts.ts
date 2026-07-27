"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function useTransactionCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "transactions"), (snap) => {
      const next: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const categoryId = d.data().categoryId as string;
        next[categoryId] = (next[categoryId] ?? 0) + 1;
      });
      setCounts(next);
    });
    return () => unsubscribe();
  }, []);

  return counts;
}
