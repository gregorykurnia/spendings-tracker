"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Transaction } from "@/types";

const transactionsRef = collection(db, "transactions");

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(transactionsRef, orderBy("date", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setTransactions(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction))
        );
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("transactions onSnapshot failed:", err);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  async function addTransaction(input: Omit<Transaction, "id" | "createdAt">) {
    await addDoc(transactionsRef, { ...input, createdAt: new Date().toISOString() });
  }

  async function updateTransaction(id: string, input: Partial<Omit<Transaction, "id">>) {
    await updateDoc(doc(transactionsRef, id), input);
  }

  async function deleteTransaction(id: string) {
    await deleteDoc(doc(transactionsRef, id));
  }

  return {
    transactions,
    loading,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
