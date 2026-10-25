"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { inChunks } from "@/lib/batches";
import { isSwatchName } from "@/lib/swatches";
import { Category, CategoryUsage } from "@/types";
import {
  SEED_CATEGORIES,
  starterCategoryId,
  TELECOMMUNICATIONS_CATEGORY,
} from "@/lib/seedCategories";

const categoriesRef = collection(db, "categories");
const transactionsRef = collection(db, "transactions");
const seedSentinelRef = doc(db, "meta", "categoriesSeeded");
const telecommunicationsMigrationRef = doc(
  db,
  "meta",
  "telecommunicationsCategorySeeded"
);
const telecommunicationsCategoryRef = doc(categoriesRef, "telecommunications");

export type SeedProgress = { done: number; total: number };

// Seeding runs once per page load, whichever screen starts it; every hook
// instance reads its progress from here.
let seedProgress: SeedProgress | null = null;
const seedListeners = new Set<() => void>();

function setSeedProgress(next: SeedProgress | null) {
  seedProgress = next;
  seedListeners.forEach((listener) => listener());
}

function subscribeSeedProgress(listener: () => void) {
  seedListeners.add(listener);
  return () => {
    seedListeners.delete(listener);
  };
}

let seedPromise: Promise<void> | null = null;

function seedIfEmpty() {
  if (!seedPromise) {
    seedPromise = (async () => {
      // The sentinel is claimed inside the same transaction as the read, so
      // tabs or devices opening at the same time can't both start from
      // scratch. It holds `startedAt` while seeding and `seededAt` once done
      // (older databases only have `seededAt`). A seeding cut short is
      // finished by the next open: starters have fixed document IDs, so
      // writing one twice changes nothing.
      const state = await runTransaction(db, async (tx) => {
        const sentinel = await tx.get(seedSentinelRef);
        if (!sentinel.exists()) {
          tx.set(seedSentinelRef, { startedAt: new Date().toISOString() });
          return "start";
        }
        return sentinel.data().seededAt ? "done" : "resume";
      });
      if (state === "done") return;

      const snap = await getDocs(categoriesRef);
      const starterIds = new Set(SEED_CATEGORIES.map((c) => starterCategoryId(c.name)));
      const existing = new Set(snap.docs.map((d) => d.id));
      // Categories that aren't starters mean the owner's data is already
      // here (a database from before the sentinel): never add to it.
      const ownersData =
        state === "start" ? !snap.empty : [...existing].some((id) => !starterIds.has(id));
      if (!ownersData) {
        const total = SEED_CATEGORIES.length;
        let done = SEED_CATEGORIES.filter((c) => existing.has(starterCategoryId(c.name))).length;
        setSeedProgress({ done, total });
        for (const category of SEED_CATEGORIES) {
          const id = starterCategoryId(category.name);
          if (existing.has(id)) continue;
          await setDoc(doc(categoriesRef, id), category);
          setSeedProgress({ done: ++done, total });
        }
      }
      await setDoc(
        seedSentinelRef,
        { seededAt: new Date().toISOString() },
        { merge: true }
      );
    })()
      .catch((err) => {
        seedPromise = null;
        throw err;
      })
      .finally(() => setSeedProgress(null));
  }
  return seedPromise;
}

async function addTelecommunicationsCategoryIfMissing() {
  const existingCategories = await getDocs(categoriesRef);
  const alreadyExists = existingCategories.docs.some(
    (category) => category.data().name === TELECOMMUNICATIONS_CATEGORY.name
  );
  const order = existingCategories.docs.reduce(
    (highest, category) => Math.max(highest, category.data().order ?? -1),
    -1
  ) + 1;

  await runTransaction(db, async (tx) => {
    const migration = await tx.get(telecommunicationsMigrationRef);
    if (migration.exists()) return;

    const category = await tx.get(telecommunicationsCategoryRef);
    tx.set(telecommunicationsMigrationRef, {
      seededAt: new Date().toISOString(),
    });

    if (!alreadyExists && !category.exists()) {
      tx.set(telecommunicationsCategoryRef, {
        ...TELECOMMUNICATIONS_CATEGORY,
        order,
      });
    }
  });
}

export class CategoryNameTakenError extends Error {
  constructor(name: string) {
    super(`A category called "${name}" already exists`);
    this.name = "CategoryNameTakenError";
  }
}

export class CategoryInUseError extends Error {
  constructor(id: string) {
    super(`Category ${id} still has spends or waiting lines; choose where they go`);
    this.name = "CategoryInUseError";
  }
}

export type CategoryFields = Pick<Category, "name" | "emoji" | "color">;

function nameKey(name: string) {
  return name.trim().toLowerCase();
}

function checkFields(fields: Partial<CategoryFields>) {
  if ("name" in fields && !fields.name?.trim()) {
    throw new Error("A category needs a name");
  }
  if ("emoji" in fields && !fields.emoji?.trim()) {
    throw new Error("A category needs an emoji");
  }
  if ("color" in fields && !isSwatchName(fields.color)) {
    throw new Error(`"${fields.color}" isn't a swatch name`);
  }
}

/** Names are unique, capitals ignored. Read from the database, not this screen's copy. */
async function checkNameFree(name: string, exceptId?: string) {
  const snap = await getDocs(categoriesRef);
  const taken = snap.docs.some(
    (d) => d.id !== exceptId && nameKey(d.data().name ?? "") === nameKey(name)
  );
  if (taken) throw new CategoryNameTakenError(name.trim());
}

/** How many spends and waiting lines use a category. */
export async function categoryUsage(categoryId: string): Promise<CategoryUsage> {
  const snap = await getDocs(query(transactionsRef, where("categoryId", "==", categoryId)));
  const usage = { spends: 0, waiting: 0 };
  snap.docs.forEach((d) => {
    if (d.data().status === "pending_review") usage.waiting++;
    else usage.spends++;
  });
  return usage;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seeding = useSyncExternalStore(
    subscribeSeedProgress,
    () => seedProgress,
    () => null
  );

  useEffect(() => {
    seedIfEmpty()
      .then(addTelecommunicationsCategoryIfMissing)
      .catch((err) => {
        console.error("category initialization failed:", err);
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

  /** Adds a category at the end of the list. Returns its ID. */
  async function addCategory(fields: CategoryFields) {
    checkFields(fields);
    await checkNameFree(fields.name);
    const order = categories.length
      ? Math.max(...categories.map((c) => c.order)) + 1
      : 0;
    const ref = await addDoc(categoriesRef, {
      name: fields.name.trim(),
      emoji: fields.emoji.trim(),
      color: fields.color,
      order,
    });
    return ref.id;
  }

  async function updateCategory(id: string, fields: Partial<CategoryFields>) {
    checkFields(fields);
    const next: Partial<CategoryFields> = { ...fields };
    if (fields.name !== undefined) {
      await checkNameFree(fields.name, id);
      next.name = fields.name.trim();
    }
    if (fields.emoji !== undefined) next.emoji = fields.emoji.trim();
    await updateDoc(doc(categoriesRef, id), next);
  }

  /** Moves a category one place up or down, numbering the whole list again. */
  async function moveCategory(id: string, direction: "up" | "down") {
    const sorted = [...categories].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((c) => c.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) return;

    [sorted[index], sorted[swapIndex]] = [sorted[swapIndex], sorted[index]];
    const batch = writeBatch(db);
    sorted.forEach((c, order) => {
      if (c.order !== order) batch.update(doc(categoriesRef, c.id), { order });
    });
    await batch.commit();
  }

  /**
   * Deletes a category. If spends or waiting lines use it, they move to
   * `moveTo` first, at most 450 per batch, and only then is the category
   * deleted; running it again after a failure finishes the job.
   */
  async function deleteCategory(
    id: string,
    moveTo?: string,
    onProgress?: (moved: number, total: number) => void
  ) {
    if (categories.length === 1 && categories[0].id === id) {
      throw new Error("The last category can't be deleted");
    }
    if (moveTo !== undefined) {
      if (moveTo === id) throw new Error("Choose a different category to move to");
      if (!(await getDoc(doc(categoriesRef, moveTo))).exists()) {
        throw new Error(`Category ${moveTo} not found`);
      }
    }

    const snap = await getDocs(query(transactionsRef, where("categoryId", "==", id)));
    if (snap.size && moveTo === undefined) throw new CategoryInUseError(id);

    let moved = 0;
    onProgress?.(moved, snap.size);
    for (const chunk of inChunks(snap.docs)) {
      const batch = writeBatch(db);
      for (const d of chunk) {
        batch.update(d.ref, { categoryId: moveTo, categorySuggested: deleteField() });
      }
      await batch.commit();
      moved += chunk.length;
      onProgress?.(moved, snap.size);
    }
    await deleteDoc(doc(categoriesRef, id));
  }

  return {
    categories,
    loading,
    error,
    /** Progress while the starter categories are being added on first open. */
    seeding,
    addCategory,
    updateCategory,
    moveCategory,
    categoryUsage,
    deleteCategory,
  };
}
