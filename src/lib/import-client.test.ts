// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fileToBase64, readScreenshotFile } from "./import-client";

const png = () => new File([new Uint8Array([137, 80, 78, 71])], "shot.png", { type: "image/png" });

function answer(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("fileToBase64", () => {
  it("gives the base64 body and the media type, without the data: prefix", async () => {
    const { data, mediaType } = await fileToBase64(png());
    expect(mediaType).toBe("image/png");
    expect(data).toBe(btoa(String.fromCharCode(137, 80, 78, 71)));
  });
});

describe("readScreenshotFile", () => {
  const line = {
    date: "2026-10-24",
    store: "KOPI",
    description: "",
    amount: 28000,
    amountText: "28.000,00 DB",
    direction: "out",
    ownTransfer: false,
  };

  it("sends one image to /api/ocr and returns its lines", async () => {
    const send = answer(200, { transactions: [line] });
    const out = await readScreenshotFile(png(), send);
    expect(out).toEqual({ kind: "lines", lines: [line] });
    const [url, init] = vi.mocked(send).mock.calls[0];
    expect(url).toBe("/api/ocr");
    expect(JSON.parse(String(init?.body))).toEqual({ image: btoa(String.fromCharCode(137, 80, 78, 71)), mediaType: "image/png" });
  });

  it("calls an empty array 'nothing found'", async () => {
    expect(await readScreenshotFile(png(), answer(200, { transactions: [] }))).toEqual({ kind: "empty" });
  });

  it("calls a non-2xx answer, a reply that isn't lines, and a network error 'couldn't read'", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await readScreenshotFile(png(), answer(502, { error: "unreadable" }))).toEqual({ kind: "fail" });
    expect(await readScreenshotFile(png(), answer(200, { nope: true }))).toEqual({ kind: "fail" });
    expect(await readScreenshotFile(png(), answer(200, null))).toEqual({ kind: "fail" });
    const down = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await readScreenshotFile(png(), down)).toEqual({ kind: "fail" });
  });
});
