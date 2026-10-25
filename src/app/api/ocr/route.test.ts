import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GOPAY_REPLY } from "@/lib/__fixtures__/ocr-replies";

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));

const { POST } = await import("./route");

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/ocr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

const screenshot = { image: "aGk=", mediaType: "image/png" };

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "fake-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
  create.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/ocr", () => {
  it("returns the lines in the new shape", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: GOPAY_REPLY }] });
    const res = await post(screenshot);

    expect(res.status).toBe(200);
    const { transactions } = await res.json();
    expect(transactions).toHaveLength(3);
    expect(transactions[0]).toEqual({
      date: "2026-10-22",
      store: "Top up from BCA",
      description: "",
      amount: 200_000,
      amountText: "+Rp200.000",
      direction: "in",
      ownTransfer: true,
    });
    expect(transactions[2].amount).toBeNull();
  });

  it("answers nothing found with an empty list", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "[]" }] });
    const res = await post(screenshot);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ transactions: [] });
  });

  it("answers couldn't read with 502 when the reply doesn't parse", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "I can't see any bank app here." }] });
    const res = await post(screenshot);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "unreadable" });
  });

  it("answers couldn't read with 502 when the API fails", async () => {
    create.mockRejectedValue(new Error("overloaded"));
    expect((await post(screenshot)).status).toBe(502);
  });

  it("refuses a request without a usable image", async () => {
    expect((await post({ mediaType: "image/png" })).status).toBe(400);
    expect((await post({ image: "aGk=", mediaType: "application/pdf" })).status).toBe(400);
    expect((await post("not json")).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("says when no API key is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await post(screenshot);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "not_configured" });
  });
});
