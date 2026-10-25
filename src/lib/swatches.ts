// Category colours are stored by swatch name; what they look like is defined only in
// `src/styles/tokens.css` (`--sw-<name>` and `--sw-<name>-tint`). `SWATCH_SOLID` below repeats the
// solid values only to match old hex colours; `swatches.test.ts` fails if it drifts from the tokens.

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

/** The solid value of each swatch (`--sw-<name>` in the tokens), used to find the nearest one. */
export const SWATCH_SOLID: Record<SwatchName, string> = {
  apricot: "#D4701C",
  mint: "#3F9A4E",
  sky: "#2F7FC4",
  rose: "#D14F86",
  lilac: "#7C5FD0",
  aqua: "#22998A",
  coral: "#DB5B43",
  sand: "#A27B4C",
  lime: "#74991A",
  indigo: "#4458C0",
  slate: "#62767F",
  plum: "#9C48A8",
  cyan: "#2490B0",
};

const FALLBACK: SwatchName = "slate";

function rgbOf(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * The swatch a stored colour stands for: a swatch name as it is, an old hex value as the nearest
 * swatch (by distance in RGB), anything else as `slate`. Reading is all it does; nothing is migrated.
 */
export function swatchFor(color: string | null | undefined): SwatchName {
  if (isSwatchName(color)) return color;
  const rgb = typeof color === "string" ? rgbOf(color) : null;
  if (!rgb) return FALLBACK;
  let best = FALLBACK;
  let bestDistance = Infinity;
  for (const name of SWATCH_NAMES) {
    const s = rgbOf(SWATCH_SOLID[name]) as [number, number, number];
    const d = (s[0] - rgb[0]) ** 2 + (s[1] - rgb[1]) ** 2 + (s[2] - rgb[2]) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = name;
    }
  }
  return best;
}

/**
 * The swatch used by the fewest categories, for a new category. Ties go to the earlier one in
 * `SWATCH_NAMES`, so with nothing used it is `apricot`.
 */
export function leastUsedSwatch(categories: readonly { color: string }[]): SwatchName {
  const used = new Map<SwatchName, number>();
  for (const c of categories) used.set(swatchFor(c.color), (used.get(swatchFor(c.color)) ?? 0) + 1);
  let best: SwatchName = SWATCH_NAMES[0];
  let fewest = Infinity;
  for (const name of SWATCH_NAMES) {
    const n = used.get(name) ?? 0;
    if (n < fewest) {
      fewest = n;
      best = name;
    }
  }
  return best;
}
