"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Category } from "@/types";
import { SEED_CATEGORIES } from "@/lib/seedCategories";

const categoriesRef = collection(db, "categories");
const transactionsRef = collection(db, "transactions");
const seedSentinelRef = doc(db, "meta", "categoriesSeeded");

let seedPromise: Promise<void> | null = null;

function seedIfEmpty() {
  if (!seedPromise) {
    seedPromise = (async () => {
      // The sentinel write happens inside the same transaction as the
      // read, so concurrent tabs/devices racing this at the same time
      // can't both observe "not seeded" and both write the batch.
      const shouldSeed = await runTransaction(db, async (tx) => {
        const sentinel = await tx.get(seedSentinelRef);
        if (sentinel.exists()) return false;
        tx.set(seedSentinelRef, { seededAt: new Date().toISOString() });
        return true;
      });
      if (!shouldSeed) return;

      const batch = writeBatch(db);
      for (const category of SEED_CATEGORIES) {
        const ref = doc(categoriesRef);
        batch.set(ref, category);
      }
      await batch.commit();
    })().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    seedIfEmpty().catch((err) => {
      console.error("seedIfEmpty failed:", err);
      setError(err.message);
    });

    const q = query(categoriesRef, orderBy("order"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setCategories(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category))
        );
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("categories onSnapshot failed:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  async function addCategory(input: Omit<Category, "id" | "order">) {
    const order = categories.length
      ? Math.max(...categories.map((c) => c.order)) + 1
      : 0;
    await addDoc(categoriesRef, { ...input, order });
  }

  async function updateCategory(id: string, input: Partial<Omit<Category, "id">>) {
    await updateDoc(doc(categoriesRef, id), input);
  }

  async function deleteCategory(id: string) {
    await deleteDoc(doc(categoriesRef, id));
  }

  async function transactionCountForCategory(categoryId: string) {
    const snap = await getDocs(
      query(transactionsRef, where("categoryId", "==", categoryId))
    );
    return snap.size;
  }

  async function reassignAndDelete(fromCategoryId: string, toCategoryId: string) {
    const snap = await getDocs(
      query(transactionsRef, where("categoryId", "==", fromCategoryId))
    );
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.update(d.ref, { categoryId: toCategoryId });
    });
    batch.delete(doc(categoriesRef, fromCategoryId));
    await batch.commit();
  }

  async function moveCategory(id: string, direction: "up" | "down") {
    const sorted = [...categories].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((c) => c.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) return;

    const a = sorted[index];
    const b = sorted[swapIndex];
    const batch = writeBatch(db);
    batch.update(doc(categoriesRef, a.id), { order: b.order });
    batch.update(doc(categoriesRef, b.id), { order: a.order });
    await batch.commit();
  }

  return {
    categories,
    loading,
    error,
    addCategory,
    updateCategory,
    deleteCategory,
    transactionCountForCategory,
    reassignAndDelete,
    moveCategory,
  };
}
