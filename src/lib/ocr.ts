// Reading one bank or wallet screenshot with Claude. Shared by `/api/ocr`
// and `/api/import`, and by `npm run ocr:try` for trying real screenshots.

import Anthropic from "@anthropic-ai/sdk";
import type { Direction, OcrLine } from "@/types";

export const OCR_MODEL = "claude-sonnet-4-6";

export const OCR_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
export type OcrMediaType = (typeof OCR_MEDIA_TYPES)[number];

export function isOcrMediaType(value: unknown): value is OcrMediaType {
  return OCR_MEDIA_TYPES.includes(value as OcrMediaType);
}

export function ocrPrompt(today: string) {
  return `This is a screenshot from one of the owner's money apps: BCA mobile banking, GoPay or Krom bank. Today is ${today}.

Extract every transaction shown, top to bottom, in the order the screenshot shows them. For each one return:
- "date": YYYY-MM-DD. When the screenshot shows no year, use the latest such date that is not after today. Use "" if there is no date you can read.
- "store": the merchant, or the name a transfer went to or came from.
- "description": any extra note shown with it, or "".
- "amount": the amount as a plain number of rupiah, no formatting and no sign (87.450,00 is 87450). Use null if you can't read it with confidence.
- "amountText": the amount exactly as printed, including any sign, currency and marks (such as "87.450,00 DB" or "-Rp45.000").
- "direction": "out" for money leaving the account, "in" for money coming in. Read it from that app's own marks: BCA prints DB (out) and CR (in); GoPay and Krom use a minus or plus sign, colours or words such as "Top up", "Received", "Payment" or "Transfer to".
- "ownTransfer": true when the money only moves between the owner's own BCA, GoPay and Krom accounts (a GoPay top-up paid from BCA, a transfer from BCA to Krom or back, a top-up received in GoPay); otherwise false.

Return a JSON array only, with no other text. Return [] if the screenshot shows no transactions.`;
}

/** Today's date in Jakarta, where the screenshots come from. */
export function jakartaToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export class OcrUnreadableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "OcrUnreadableError";
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRealDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * A rupiah amount from a number or, when the model sends text anyway, from
 * the Indonesian form ("87.450,00", "Rp45.000"). Returns a positive whole
 * number of rupiah, or null.
 */
export function parseAmount(value: unknown): number | null {
  let n: number;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string") {
    const digits = value.replace(/[^\d.,]/g, "");
    if (!/\d/.test(digits)) return null;
    // Dots group thousands; a comma starts the cents.
    const [whole, cents = ""] = digits.split(",");
    n = Number(`${whole.replace(/\./g, "")}.${cents.replace(/\./g, "") || "0"}`);
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(Math.abs(n));
  return rounded > 0 ? rounded : null;
}

function direction(value: unknown): Direction {
  return value === "in" ? "in" : "out";
}

function toLine(item: unknown): OcrLine | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const raw = item as Record<string, unknown>;
  const date = text(raw.date);
  const amount = parseAmount(raw.amount);
  const amountText =
    text(raw.amountText) || (typeof raw.amount === "string" ? raw.amount.trim() : "");
  return {
    date: isRealDate(date) ? date : "",
    store: text(raw.store),
    description: text(raw.description),
    amount,
    amountText,
    direction: direction(raw.direction),
    ownTransfer: raw.ownTransfer === true,
  };
}

/**
 * Turns the model's reply into lines. An empty array is a real answer
 * ("Nothing found"); anything that isn't a JSON array of lines throws
 * OcrUnreadableError ("Couldn't read this one").
 */
export function parseOcrReply(reply: string): OcrLine[] {
  const start = reply.indexOf("[");
  const end = reply.lastIndexOf("]");
  if (start < 0 || end < start) {
    throw new OcrUnreadableError("The reply has no JSON array");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.slice(start, end + 1));
  } catch (err) {
    throw new OcrUnreadableError("The reply's JSON array doesn't parse", { cause: err });
  }
  if (!Array.isArray(parsed)) {
    throw new OcrUnreadableError("The reply isn't a JSON array");
  }
  const lines = parsed.map(toLine).filter((l): l is OcrLine => l !== null);
  if (parsed.length > 0 && lines.length === 0) {
    throw new OcrUnreadableError("No line in the reply has the expected shape");
  }
  // A line with nothing readable at all is noise, not a transaction.
  return lines.filter((l) => l.store || l.amount !== null || l.amountText);
}

type MessagesClient = Pick<Anthropic, "messages">;

/** Reads one screenshot. Throws OcrUnreadableError for every kind of failure. */
export async function readScreenshot(
  input: { image: string; mediaType: OcrMediaType },
  options: { client?: MessagesClient; today?: string } = {}
): Promise<OcrLine[]> {
  const client = options.client ?? new Anthropic();
  let reply: string;
  try {
    const message = await client.messages.create({
      model: OCR_MODEL,
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: input.mediaType, data: input.image },
            },
            { type: "text", text: ocrPrompt(options.today ?? jakartaToday()) },
          ],
        },
      ],
    });
    if (message.stop_reason === "refusal" || message.stop_reason === "max_tokens") {
      throw new OcrUnreadableError(`The reply stopped early: ${message.stop_reason}`);
    }
    reply = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
  } catch (err) {
    if (err instanceof OcrUnreadableError) throw err;
    throw new OcrUnreadableError("The Claude API call failed", { cause: err });
  }
  return parseOcrReply(reply);
}
