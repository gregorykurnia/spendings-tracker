// Whole rupiah with dots between thousands. Done by hand, not with `toLocaleString`, so the output
// is the same on every device and Node build.

function dots(n: number) {
  return String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** `Rp 1.234.567`. A negative amount puts the sign in front: `-Rp 1.000`. A waiting line whose amount couldn't be read (`null`) says so. */
export function formatRupiah(amount: number | null | undefined) {
  if (amount == null) return "No amount";
  const rounded = Math.round(amount);
  return `${rounded < 0 ? "-" : ""}Rp ${dots(rounded)}`;
}

/** The number without the `Rp`, for the big totals that show `Rp` smaller beside it. */
export function formatDigits(amount: number) {
  const rounded = Math.round(amount);
  return `${rounded < 0 ? "-" : ""}${dots(rounded)}`;
}

/** The bank's own form, `87.450,00 DB` (money out) or `87.450,00 CR` (money in). */
export function formatBankAmount(amount: number, direction: "out" | "in" = "out") {
  return `${dots(amount)},00 ${direction === "in" ? "CR" : "DB"}`;
}

/** `1 spend`, `2 spends`. Pass `many` when the plural isn't just an added "s" (`line`, `lines`). */
export function countLabel(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Ten digits or more: the big total drops to a smaller size so it fits a phone. */
export function isLongTotal(amount: number) {
  return String(Math.abs(Math.round(amount))).length >= 10;
}
