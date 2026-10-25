import { describe, expect, it } from "vitest";
import { countLabel, formatBankAmount, formatDigits, formatRupiah, isLongTotal } from "./money";

describe("formatRupiah", () => {
  it("puts dots between thousands", () => {
    expect(formatRupiah(0)).toBe("Rp 0");
    expect(formatRupiah(999)).toBe("Rp 999");
    expect(formatRupiah(1000)).toBe("Rp 1.000");
    expect(formatRupiah(1234567)).toBe("Rp 1.234.567");
  });
  it("keeps a ten-digit total whole", () => {
    expect(formatRupiah(1234567890)).toBe("Rp 1.234.567.890");
    expect(formatRupiah(48_250_000)).toBe("Rp 48.250.000");
  });
  it("rounds to whole rupiah and puts a minus sign in front", () => {
    expect(formatRupiah(1999.6)).toBe("Rp 2.000");
    expect(formatRupiah(-475650)).toBe("-Rp 475.650");
  });
  it("formats the digits alone for the big total", () => {
    expect(formatDigits(6842350)).toBe("6.842.350");
  });
});

describe("formatBankAmount", () => {
  it("writes the bank's form with DB for money out and CR for money in", () => {
    expect(formatBankAmount(87450)).toBe("87.450,00 DB");
    expect(formatBankAmount(87450, "out")).toBe("87.450,00 DB");
    expect(formatBankAmount(1500000, "in")).toBe("1.500.000,00 CR");
  });
});

describe("countLabel", () => {
  it("uses the singular for one and the plural for the rest", () => {
    expect(countLabel(1, "spend")).toBe("1 spend");
    expect(countLabel(0, "spend")).toBe("0 spends");
    expect(countLabel(2, "spend")).toBe("2 spends");
    expect(countLabel(1, "line is", "lines are")).toBe("1 line is");
    expect(countLabel(3, "line is", "lines are")).toBe("3 lines are");
  });
});

describe("isLongTotal", () => {
  it("is true from ten digits", () => {
    expect(isLongTotal(999_999_999)).toBe(false);
    expect(isLongTotal(1_000_000_000)).toBe(true);
  });
});
