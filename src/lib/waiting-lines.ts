// Waiting lines as they are stored: read back from Firestore, and written from the lines read off one
// screenshot. Shared by the app's import (`useTransactions`) and the share route (`/api/import`).

import type { DocumentData } from "firebase/firestore";
import { isISODate } from "@/lib/dates";
import { suggestCategoryId } from "@/lib/suggest";
import type { OcrLine, Transaction } from "@/types";

/**
 * Dates are stored as `YYYY-MM-DD`. Lines saved by the old OCR page could hold whatever the reader
 * returned: a date with a time keeps its day, and anything else reads as no date.
 */
function readDate(value: unknown) {
  if (typeof value !== "string") return "";
  const day = value.slice(0, 10);
  return isISODate(day) ? day : "";
}

/** Reads a stored document, old shapes included. */
export function toTransaction(id: string, data: DocumentData): Transaction {
  return {
    ...data,
    id,
    amount: typeof data.amount === "number" ? data.amount : null,
    store: data.store ?? "",
    description: data.description ?? "",
    categoryId: data.categoryId ?? "",
    date: readDate(data.date),
    source: data.source === "ocr" ? "ocr" : "manual",
    status: data.status === "pending_review" ? "pending_review" : "confirmed",
    createdAt: data.createdAt ?? "",
  };
}

/**
 * The documents for the lines read from one screenshot, in the screenshot's order. They all carry the
 * same `createdAt` (the batch time); `seq` keeps their order within it. A line gets the category of the
 * latest spend at the same store, marked as suggested.
 */
export function waitingLineDocs(
  lines: readonly OcrLine[],
  {
    spends,
    categoryIds,
    createdAt,
    importedVia,
  }: {
    spends: readonly Transaction[];
    categoryIds: ReadonlySet<string>;
    createdAt: string;
    /** Set for screenshots shared from the phone. */
    importedVia?: Transaction["importedVia"];
  }
) {
  return lines.map((line, seq) => {
    const suggested = suggestCategoryId(line.store, spends, categoryIds);
    return {
      amount: line.amount,
      store: line.store,
      description: line.description,
      categoryId: suggested ?? "",
      date: line.date,
      source: "ocr" as const,
      status: "pending_review" as const,
      createdAt,
      seq,
      direction: line.direction,
      bankLine: { store: line.store, date: line.date, amountText: line.amountText },
      ...(suggested ? { categorySuggested: true } : {}),
      ...(line.ownTransfer ? { ownTransfer: true } : {}),
      ...(importedVia ? { importedVia } : {}),
    };
  });
}
