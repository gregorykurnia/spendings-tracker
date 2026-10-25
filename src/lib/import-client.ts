// Sends one screenshot to `/api/ocr` from the browser. The route's contract (src/app/api/ocr/route.ts):
//   200 { transactions: OcrLine[] }, where [] means "Nothing found"
//   any other status: "Couldn't read this one"
// This file stays free of `@/lib/ocr`, which pulls the Claude SDK into the browser bundle.

import type { OcrLine } from "@/types";

export type ReadOutcome =
  | { kind: "lines"; lines: OcrLine[] }
  | { kind: "empty" }
  | { kind: "fail" };

/** The file as base64 (no `data:` prefix) and the media type the route wants. */
export function fileToBase64(file: Blob): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      const mediaType = result.slice(0, comma).match(/^data:(.*);base64$/)?.[1] ?? file.type;
      resolve({ data: result.slice(comma + 1), mediaType });
    };
    reader.onerror = () => reject(reader.error ?? new Error("The file couldn't be read"));
    reader.readAsDataURL(file);
  });
}

/** Reads one screenshot. Never throws: every kind of failure is `{ kind: "fail" }`. */
export async function readScreenshotFile(
  file: Blob,
  send: typeof fetch = (input, init) => fetch(input, init)
): Promise<ReadOutcome> {
  try {
    const { data, mediaType } = await fileToBase64(file);
    const res = await send("/api/ocr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: data, mediaType }),
    });
    if (!res.ok) return { kind: "fail" };
    const body: unknown = await res.json();
    const lines = (body as { transactions?: unknown } | null)?.transactions;
    if (!Array.isArray(lines)) return { kind: "fail" };
    return lines.length ? { kind: "lines", lines: lines as OcrLine[] } : { kind: "empty" };
  } catch (err) {
    console.error("reading a screenshot failed:", err);
    return { kind: "fail" };
  }
}
