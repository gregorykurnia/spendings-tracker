import type { Transaction } from "@/types";

function storeKey(store: string) {
  return store.trim().toLowerCase();
}

/**
 * The category of the latest confirmed spend at the same store (trimmed,
 * capitals ignored), if that category still exists; otherwise null.
 */
export function suggestCategoryId(
  store: string,
  transactions: Transaction[],
  categoryIds: ReadonlySet<string>
): string | null {
  const key = storeKey(store);
  if (!key) return null;
  let latest: Transaction | null = null;
  for (const t of transactions) {
    if (t.status !== "confirmed" || storeKey(t.store) !== key) continue;
    if (
      !latest ||
      t.date > latest.date ||
      (t.date === latest.date && t.createdAt > latest.createdAt)
    ) {
      latest = t;
    }
  }
  return latest && categoryIds.has(latest.categoryId) ? latest.categoryId : null;
}
