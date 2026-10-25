// Category colours are stored by swatch name; the colours themselves live
// only in `src/styles/tokens.css` (`--sw-<name>` and `--sw-<name>-tint`).

export const SWATCH_NAMES = [
  "apricot",
  "mint",
  "sky",
  "rose",
  "lilac",
  "aqua",
  "coral",
  "sand",
  "lime",
  "indigo",
  "slate",
  "plum",
  "cyan",
] as const;

export type SwatchName = (typeof SWATCH_NAMES)[number];

export function isSwatchName(value: unknown): value is SwatchName {
  return SWATCH_NAMES.includes(value as SwatchName);
}
