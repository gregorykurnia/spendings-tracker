import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed-emulator";

describe("buildSeed", () => {
  it("builds the normal set with the sixteen starter categories", () => {
    const seed = buildSeed("normal", "2026-10-25");
    expect(seed.categories).toHaveLength(16);
    expect(seed.transactions.filter((t) => t.data.status === "confirmed")).toHaveLength(60);
    expect(seed.transactions.filter((t) => t.data.status === "pending_review")).toHaveLength(3);
  });

  it("builds the stress set with 507 spends and an extra long-named category", () => {
    const seed = buildSeed("stress", "2026-10-25");
    expect(seed.categories).toHaveLength(17);
    expect(seed.transactions.filter((t) => t.data.status === "confirmed")).toHaveLength(507);
  });

  it("is the same on every run and only uses categories it creates", () => {
    const a = buildSeed("normal", "2026-10-25");
    expect(buildSeed("normal", "2026-10-25")).toEqual(a);
    const ids = new Set(a.categories.map((c) => c.id));
    for (const t of a.transactions) expect(ids).toContain(t.data.categoryId);
  });

  it("keeps every date on or before today", () => {
    for (const t of buildSeed("stress", "2026-10-25").transactions) {
      expect(String(t.data.date) <= "2026-10-25").toBe(true);
    }
  });
});
