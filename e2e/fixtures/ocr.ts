// What the e2e specs put in place of the Claude API: `/api/ocr` answers from a list, one reply per
// screenshot, in the order the app sends them (it reads one at a time). No spec reaches Claude.

import type { Page } from "@playwright/test";
import type { OcrLine } from "../../src/types";

/** A real 1x1 PNG, so a file picker has something to take. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/** `n` screenshots for `setInputFiles`. */
export function screenshots(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    name: `screenshot-${i + 1}.png`,
    mimeType: "image/png",
    buffer: PNG,
  }));
}

export function bankLine(over: Partial<OcrLine> & Pick<OcrLine, "store" | "amount">): OcrLine {
  return {
    date: "",
    description: "",
    amountText: `${over.amount === null ? "" : String(over.amount).replace(/\B(?=(\d{3})+(?!\d))/g, ".")},00 DB`,
    direction: "out",
    ownTransfer: false,
    ...over,
  };
}

/** One answer from the route: lines (an empty list is "Nothing found"), or a failure. */
export type Reply = {
  /** `"fail"` answers 502, which the app calls "Couldn't read this one". */
  lines: OcrLine[] | "fail";
  /** Held until this resolves, so a spec can look at the screen while the screenshot is being read. */
  hold?: Promise<void>;
};

export async function mockOcr(page: Page, replies: Reply[]) {
  const queue = [...replies];
  const seen: unknown[] = [];
  await page.route("**/api/ocr", async (route) => {
    const reply = queue.shift();
    seen.push(route.request().postDataJSON());
    if (!reply) return route.fulfill({ status: 500, json: { error: "no reply was planned" } });
    await reply.hold;
    if (reply.lines === "fail") return route.fulfill({ status: 502, json: { error: "unreadable" } });
    return route.fulfill({ json: { transactions: reply.lines } });
  });
  return {
    /** Plans one more reply (for "Try again"). */
    push: (reply: Reply) => void queue.push(reply),
    /** The bodies the app has sent so far. */
    requests: () => seen,
  };
}

/** A promise a spec settles by hand. */
export function gate() {
  let open!: () => void;
  const hold = new Promise<void>((resolve) => (open = resolve));
  return { hold, open };
}
