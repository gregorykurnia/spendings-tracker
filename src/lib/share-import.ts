// The pieces of `/api/import` that need no database: the token check, reading the shared image out of
// the request, and the words the Shortcut shows. See docs/iphone-shortcut.md.

import { createHash, timingSafeEqual } from "node:crypto";
import { countLabel } from "@/lib/money";
import { MAX_IMAGE_CHARS, type OcrMediaType } from "@/lib/ocr";

/** The biggest image accepted, in bytes: what fits in `MAX_IMAGE_CHARS` once it is base64. */
export const MAX_IMAGE_BYTES = Math.floor((MAX_IMAGE_CHARS / 4) * 3);

/**
 * Whether `Authorization: Bearer <token>` carries the import token. Both sides are hashed first, so the
 * compare takes the same time whatever was sent and however long it is.
 */
export function tokenMatches(header: string | null, token: string) {
  const sent = /^Bearer\s+(\S+)\s*$/i.exec(header?.trim() ?? "")?.[1];
  if (!sent || !token) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(sent), digest(token));
}

/** The image type from its first bytes: Shortcuts doesn't always send a useful `Content-Type`. */
export function sniffMediaType(bytes: Uint8Array): OcrMediaType | null {
  const starts = (...values: number[]) => values.every((v, i) => bytes[i] === v);
  const ascii = (from: number, text: string) =>
    [...text].every((ch, i) => bytes[from + i] === ch.charCodeAt(0));
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (ascii(0, "GIF8")) return "image/gif";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  return null;
}

export type SharedImage =
  | { kind: "image"; image: string; mediaType: OcrMediaType }
  | { kind: "missing" | "too_big" | "not_image" };

/**
 * The one image in a share: the raw body ("Get Contents of URL" with a File body), or the first file
 * of a form (a Form body).
 */
export async function readSharedImage(request: Request): Promise<SharedImage> {
  const declared = Number(request.headers.get("content-length"));
  // A form adds a little around the file.
  if (declared > MAX_IMAGE_BYTES + 64_000) return { kind: "too_big" };

  let bytes: Uint8Array;
  try {
    if ((request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
      const form = await request.formData();
      const file = [...form.values()].find((value): value is File => typeof value !== "string");
      if (!file) return { kind: "missing" };
      bytes = new Uint8Array(await file.arrayBuffer());
    } else {
      bytes = new Uint8Array(await request.arrayBuffer());
    }
  } catch {
    return { kind: "missing" };
  }
  if (!bytes.length) return { kind: "missing" };
  if (bytes.length > MAX_IMAGE_BYTES) return { kind: "too_big" };
  const mediaType = sniffMediaType(bytes);
  if (!mediaType) return { kind: "not_image" };
  return { kind: "image", image: Buffer.from(bytes).toString("base64"), mediaType };
}

/** What the Shortcut shows. Plain words, one or two short sentences. */
export const SHARE_REPLIES = {
  off: "Sharing to Daybook is off.",
  notAllowed: "Not allowed. Check the token in the Shortcut.",
  missing: "No screenshot came with this. Share a screenshot.",
  notImage: "Couldn't read this one. Share a screenshot (PNG or JPEG).",
  tooBig: "Couldn't read this one. It's too big.",
  unreadable: "Couldn't read this one.",
  nothing: "Nothing found.",
  notSaved: "Couldn't save them. Try again in a moment.",
} as const;

/** "Read 4 transactions. They're waiting in Daybook." */
export function readReply(count: number) {
  return `Read ${countLabel(count, "transaction")}. ${count === 1 ? "It's" : "They're"} waiting in Daybook.`;
}
