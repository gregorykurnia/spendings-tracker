import { describe, expect, it, vi } from "vitest";
import { BCA_REPLY, GOPAY_REPLY, KROM_REPLY } from "./__fixtures__/ocr-replies";
import {
  jakartaToday,
  OcrUnreadableError,
  ocrPrompt,
  parseAmount,
  parseOcrReply,
  readScreenshot,
} from "./ocr";

describe("parseOcrReply", () => {
  it("reads a BCA list with DB/CR marks and a GoPay top-up", () => {
    expect(parseOcrReply(BCA_REPLY)).toEqual([
      { date: "2026-10-20", store: "KOPI KENANGAN", description: "QRIS", amount: 45_000, amountText: "45.000,00 DB", direction: "out", ownTransfer: false },
      { date: "2026-10-21", store: "TRSF E-BANKING CR ANDI", description: "Dinner split", amount: 150_000, amountText: "150.000,00 CR", direction: "in", ownTransfer: false },
      { date: "2026-10-22", store: "GOPAY TOPUP", description: "", amount: 200_000, amountText: "200.000,00 DB", direction: "out", ownTransfer: true },
    ]);
  });

  it("reads GoPay, keeping an unreadable amount as null with its printed text", () => {
    const lines = parseOcrReply(GOPAY_REPLY);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ store: "Top up from BCA", direction: "in", ownTransfer: true, amountText: "+Rp200.000" });
    expect(lines[1]).toMatchObject({ amount: 87_450, direction: "out", ownTransfer: false });
    expect(lines[2]).toMatchObject({ store: "GoRide", amount: null, amountText: "-Rp1?.0?0" });
  });

  it("reads Krom, with an own transfer, text amounts and a bad date", () => {
    const lines = parseOcrReply(KROM_REPLY);
    expect(lines[0]).toMatchObject({ amount: 1_250_000, direction: "out", ownTransfer: true });
    expect(lines[1]).toMatchObject({ store: "Interest", description: "Bunga harian", amount: 1_234, direction: "in" });
    // No ownTransfer field means false; a date that isn't YYYY-MM-DD is dropped.
    expect(lines[2]).toMatchObject({ store: "Tokopedia", date: "", ownTransfer: false, direction: "out" });
  });

  it("keeps the order the screenshot showed", () => {
    expect(parseOcrReply(KROM_REPLY).map((l) => l.store)).toEqual([
      "Transfer to BCA Gregory",
      "Interest",
      "Tokopedia",
    ]);
  });

  it("treats an empty array as nothing found", () => {
    expect(parseOcrReply("[]")).toEqual([]);
    expect(parseOcrReply("No transactions here.\n[]")).toEqual([]);
  });

  it("defaults a missing or odd direction to out", () => {
    const [line] = parseOcrReply('[{"store": "Indomaret", "amount": 12000, "direction": "debit"}]');
    expect(line).toMatchObject({ direction: "out", date: "", description: "", amountText: "" });
  });

  it("drops lines with nothing readable and items that aren't objects", () => {
    expect(parseOcrReply('[{"store": "", "amount": null}, "x", {"store": "Grab", "amount": 30000}]')).toHaveLength(1);
  });

  it("refuses replies that aren't a JSON array of lines", () => {
    expect(() => parseOcrReply("Sorry, I can't read this image.")).toThrow(OcrUnreadableError);
    expect(() => parseOcrReply("[{store: Grab}]")).toThrow(OcrUnreadableError);
    expect(() => parseOcrReply('["a", 1]')).toThrow(OcrUnreadableError);
  });

  it("drops impossible dates", () => {
    const [line] = parseOcrReply('[{"date": "2026-02-30", "store": "Grab", "amount": 1}]');
    expect(line.date).toBe("");
  });
});

describe("parseAmount", () => {
  it("reads numbers and Indonesian amount text", () => {
    expect(parseAmount(87450)).toBe(87_450);
    expect(parseAmount(-45000)).toBe(45_000);
    expect(parseAmount("87.450,00 DB")).toBe(87_450);
    expect(parseAmount("Rp1.250.000")).toBe(1_250_000);
    expect(parseAmount("12.345,60")).toBe(12_346);
    expect(parseAmount("45000.50")).toBe(45_001);
    expect(parseAmount("45.000")).toBe(45_000);
  });

  it("reads Krom's English amount text", () => {
    expect(parseAmount("IDR 51,000.00")).toBe(51_000);
    expect(parseAmount("IDR 170,940.00")).toBe(170_940);
    expect(parseAmount("1,250,000")).toBe(1_250_000);
    expect(parseAmount("-IDR 51,700.50")).toBe(51_701);
  });

  it("returns null for nothing, zero and non-numbers", () => {
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(0)).toBeNull();
    expect(parseAmount("Rp")).toBeNull();
    expect(parseAmount(Number.NaN)).toBeNull();
  });
});

describe("readScreenshot", () => {
  function clientReplying(reply: string, stop_reason = "end_turn") {
    const create = vi.fn().mockResolvedValue({ stop_reason, content: [{ type: "text", text: reply }] });
    return { create, client: { messages: { create } } as never };
  }

  it("sends the image and a prompt with today's date to the pinned model", async () => {
    const { create, client } = clientReplying(BCA_REPLY);
    const lines = await readScreenshot({ image: "aGk=", mediaType: "image/png" }, { client, today: "2026-10-25" });

    expect(lines).toHaveLength(3);
    const request = create.mock.calls[0][0];
    expect(request.model).toBe("claude-sonnet-4-6");
    expect(request.messages[0].content[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "aGk=" },
    });
    expect(request.messages[0].content[1].text).toContain("Today is 2026-10-25.");
    expect(request).not.toHaveProperty("temperature");
  });

  it("turns an API failure, a refusal or a cut-off reply into OcrUnreadableError", async () => {
    const failing = { messages: { create: vi.fn().mockRejectedValue(new Error("529 overloaded")) } } as never;
    await expect(readScreenshot({ image: "aGk=", mediaType: "image/png" }, { client: failing })).rejects.toThrow(OcrUnreadableError);
    await expect(
      readScreenshot({ image: "aGk=", mediaType: "image/png" }, { client: clientReplying("", "refusal").client })
    ).rejects.toThrow(OcrUnreadableError);
    await expect(
      readScreenshot({ image: "aGk=", mediaType: "image/png" }, { client: clientReplying("[{", "max_tokens").client })
    ).rejects.toThrow(OcrUnreadableError);
  });
});

describe("prompt and dates", () => {
  it("names the three apps and every field", () => {
    const prompt = ocrPrompt("2026-10-25");
    for (const word of ["BCA", "GoPay", "Krom", "amountText", "direction", "ownTransfer", "null"]) {
      expect(prompt).toContain(word);
    }
  });

  it("uses Jakarta's date", () => {
    expect(jakartaToday(new Date("2026-10-24T18:30:00Z"))).toBe("2026-10-25");
    expect(jakartaToday(new Date("2026-10-24T16:30:00Z"))).toBe("2026-10-24");
  });
});
