import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SWATCH_NAMES, SWATCH_SOLID, isSwatchName, leastUsedSwatch, swatchFor } from "./swatches";

describe("swatchFor", () => {
  it("returns a swatch name as it is", () => {
    for (const name of SWATCH_NAMES) expect(swatchFor(name)).toBe(name);
  });
  it("reads an old hex colour as the nearest swatch", () => {
    expect(swatchFor("#D4701C")).toBe("apricot");
    expect(swatchFor("#d4701c")).toBe("apricot");
    expect(swatchFor("#2a78d6")).toBe("sky"); // the old chart blue
    expect(swatchFor("#e34948")).toBe("coral"); // the old chart red
    expect(swatchFor("#1baf7a")).toBe("aqua");
    expect(swatchFor("#c33")).toBe("coral"); // short form
  });
  it("falls back to slate for anything unreadable", () => {
    expect(swatchFor("")).toBe("slate");
    expect(swatchFor("not a colour")).toBe("slate");
    expect(swatchFor(undefined)).toBe("slate");
    expect(swatchFor(null)).toBe("slate");
  });
});

describe("leastUsedSwatch", () => {
  it("starts with the first swatch when nothing is used", () => {
    expect(leastUsedSwatch([])).toBe("apricot");
  });
  it("skips used swatches and counts old hex colours as their nearest swatch", () => {
    expect(leastUsedSwatch([{ color: "apricot" }, { color: "#3F9A4E" }])).toBe("sky");
  });
  it("picks the least used once every swatch is used, earlier first on a tie", () => {
    const all = SWATCH_NAMES.map((color) => ({ color }));
    expect(leastUsedSwatch(all)).toBe("apricot");
    expect(leastUsedSwatch([...all, { color: "apricot" }, { color: "mint" }])).toBe("sky");
  });
});

describe("isSwatchName", () => {
  it("accepts names only", () => {
    expect(isSwatchName("mint")).toBe(true);
    expect(isSwatchName("#3F9A4E")).toBe(false);
  });
});

describe("SWATCH_SOLID", () => {
  it("matches the design tokens", () => {
    const candidates = ["src/styles/tokens.css", "redesign/design/tokens.css"].map((p) =>
      path.resolve(import.meta.dirname, "../..", p)
    );
    const file = candidates.find((p) => existsSync(p));
    expect(file, "tokens.css not found").toBeTruthy();
    const css = readFileSync(file as string, "utf8");
    for (const name of SWATCH_NAMES) {
      const m = new RegExp(`--sw-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
      expect(m?.[1].toUpperCase(), name).toBe(SWATCH_SOLID[name].toUpperCase());
    }
  });
});
