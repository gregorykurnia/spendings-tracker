// @vitest-environment node
// The share route against the Firestore emulator. The Claude call goes to a local fake through
// ANTHROPIC_BASE_URL, so no test reaches the Claude API.

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { terminate } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GOPAY_REPLY } from "@/lib/__fixtures__/ocr-replies";
import { clearEmulator, listDocs, writeDocs } from "../../../../scripts/test-env";
import { POST } from "./route";

const TOKEN = "test-import-token-0123456789";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

// What the fake Claude answers next: a reply text, or an HTTP error status.
let answer: { text: string } | { status: number } = { text: "[]" };
let calls = 0;
let fake: Server;

beforeAll(async () => {
  fake = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      calls++;
      res.setHeader("content-type", "application/json");
      if ("status" in answer) {
        res.statusCode = answer.status;
        res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "fake" } }));
        return;
      }
      res.end(
        JSON.stringify({
          id: "msg_fake",
          type: "message",
          role: "assistant",
          model: "claude-sonnet-4-6",
          content: [{ type: "text", text: answer.text }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        })
      );
    });
  });
  await new Promise<void>((resolve) => fake.listen(0, "127.0.0.1", resolve));
});

afterAll(async () => {
  await new Promise((resolve) => fake.close(resolve));
  await terminate(db);
});

beforeEach(async () => {
  await clearEmulator();
  calls = 0;
  answer = { text: "[]" };
  vi.stubEnv("IMPORT_TOKEN", TOKEN);
  vi.stubEnv("ANTHROPIC_API_KEY", "fake-key");
  vi.stubEnv("ANTHROPIC_BASE_URL", `http://127.0.0.1:${(fake.address() as AddressInfo).port}`);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function share(authorization?: string, body: BodyInit = PNG) {
  return POST(
    new Request("http://localhost/api/import", {
      method: "POST",
      headers: { "content-type": "image/png", ...(authorization ? { authorization } : {}) },
      body,
    })
  );
}

async function said(res: Response) {
  return { status: res.status, text: await res.text() };
}

describe("POST /api/import", () => {
  it("with the right token, writes the lines as waiting lines tagged as shared", async () => {
    await writeDocs("categories", [
      { id: "food-drink", data: { name: "Food & Drink", emoji: "🍽️", color: "apricot", order: 0 } },
    ]);
    await writeDocs("transactions", [
      {
        id: "earlier",
        data: {
          amount: 60_000,
          store: "gofood bakmi gm ",
          description: "",
          categoryId: "food-drink",
          date: "2026-10-01",
          source: "manual",
          status: "confirmed",
          createdAt: "2026-10-01T10:00:00.000Z",
        },
      },
    ]);
    answer = { text: GOPAY_REPLY };

    expect(await said(await share(`Bearer ${TOKEN}`))).toEqual({
      status: 200,
      text: "Read 3 transactions. They're waiting in Daybook.",
    });

    const lines = (await listDocs("transactions"))
      .map((d) => d.data)
      .filter((d) => d.status === "pending_review")
      .sort((a, b) => Number(a.seq) - Number(b.seq));
    expect(lines).toHaveLength(3);
    const batch = lines[0].createdAt;
    expect(typeof batch).toBe("string");
    expect(lines.every((l) => l.createdAt === batch && l.importedVia === "share" && l.source === "ocr")).toBe(true);
    expect(lines.map((l) => l.seq)).toEqual([0, 1, 2]);
    expect(lines[0]).toMatchObject({
      store: "Top up from BCA",
      direction: "in",
      ownTransfer: true,
      categoryId: "",
      bankLine: { store: "Top up from BCA", date: "2026-10-22", amountText: "+Rp200.000" },
    });
    // The same store as an earlier spend, so its category is suggested.
    expect(lines[1]).toMatchObject({ store: "GoFood Bakmi GM", categoryId: "food-drink", categorySuggested: true });
    expect(lines[2]).toMatchObject({ store: "GoRide", amount: null });
  });

  it("refuses a wrong or missing token, and writes nothing", async () => {
    answer = { text: GOPAY_REPLY };
    const refused = { status: 401, text: "Not allowed. Check the token in the Shortcut." };
    expect(await said(await share(`Bearer ${TOKEN}x`))).toEqual(refused);
    expect(await said(await share())).toEqual(refused);
    expect(await said(await share(TOKEN))).toEqual(refused);
    expect(calls).toBe(0);
    expect(await listDocs("transactions")).toEqual([]);
  });

  it("is off when no token is set", async () => {
    vi.stubEnv("IMPORT_TOKEN", "");
    expect(await said(await share("Bearer "))).toEqual({ status: 404, text: "Sharing to Daybook is off." });
    expect(calls).toBe(0);
  });

  it("says when a screenshot couldn't be read, and writes nothing", async () => {
    answer = { status: 400 };
    expect(await said(await share(`Bearer ${TOKEN}`))).toEqual({ status: 502, text: "Couldn't read this one." });
    answer = { text: "Sorry, I can't make this out." };
    expect(await said(await share(`Bearer ${TOKEN}`))).toEqual({ status: 502, text: "Couldn't read this one." });
    expect(calls).toBe(2);
    expect(await listDocs("transactions")).toEqual([]);
  });

  it("says when nothing was found, and writes nothing", async () => {
    answer = { text: "[]" };
    expect(await said(await share(`Bearer ${TOKEN}`))).toEqual({ status: 200, text: "Nothing found." });
    expect(await listDocs("transactions")).toEqual([]);
  });

  it("refuses something that isn't an image before reading it", async () => {
    expect(await said(await share(`Bearer ${TOKEN}`, "hello"))).toEqual({
      status: 415,
      text: "Couldn't read this one. Share a screenshot (PNG or JPEG).",
    });
    expect(calls).toBe(0);
  });
});
