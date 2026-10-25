export type Category = {
  id: string;
  name: string;
  emoji: string;
  /** A swatch name (`apricot`, `mint`, …). Older documents hold a hex value, read through `swatchFor()`. */
  color: string;
  order: number;
};

/** Money going out of an account or coming in. A missing value means out. */
export type Direction = "out" | "in";

/** What the screenshot said, for the "From the screenshot" crop. */
export type BankLine = {
  store: string;
  date: string;
  /** The amount exactly as printed, such as `87.450,00 DB` or `-Rp45.000`. */
  amountText: string;
};

export type Transaction = {
  id: string;
  /** `null` only on a waiting line whose amount couldn't be read. */
  amount: number | null;
  store: string;
  description: string;
  /** `""` on a waiting line with no category yet. */
  categoryId: string;
  date: string;
  source: "manual" | "ocr";
  status: "confirmed" | "pending_review";
  createdAt: string;
  direction?: Direction;
  bankLine?: BankLine;
  /** Order within one screenshot: lines sort by `createdAt`, then `seq`. */
  seq?: number;
  /** Set by "Keep it" or "It's a spend": the line no longer needs a look for a repeat, incoming money or an own transfer. */
  kept?: boolean;
  /** The category came from an earlier spend at the same store and hasn't been touched since. */
  categorySuggested?: boolean;
  /** The reader saw money moving between the owner's own BCA, GoPay and Krom accounts. */
  ownTransfer?: boolean;
  /** `"share"`: the screenshot was shared from the phone to `/api/import`, not added in the app. */
  importedVia?: "share";
};

/** One line read from a screenshot by `/api/ocr`. */
export type OcrLine = {
  /** `YYYY-MM-DD`, or `""` when it couldn't be read. */
  date: string;
  store: string;
  description: string;
  amount: number | null;
  amountText: string;
  direction: Direction;
  ownTransfer: boolean;
};

/** Spends (confirmed) and waiting lines in one category. */
export type CategoryUsage = { spends: number; waiting: number };
