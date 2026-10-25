// Screenshots shared from the phone (`/api/import`) arrive as waiting lines while the app is closed.
// Home's tray says so once, in the shape of a finished import: "From your phone: read 2 screenshots".

import { countLabel } from "@/lib/money";
import type { Transaction } from "@/types";
import type { Shot } from "./tray";

/** Where the newest shared batch already shown on this device is kept (its `createdAt`). */
export const SHARE_SEEN_KEY = "daybook.shareSeen";

/**
 * The shared screenshots still waiting that came in after `since` (a `createdAt`), oldest first, as
 * finished tray rows: one per screenshot, with how many of its lines are waiting.
 */
export function sharedShots(waiting: readonly Transaction[], since: string): Shot[] {
  const found = new Map<string, number>();
  for (const line of waiting) {
    if (line.importedVia !== "share" || line.createdAt <= since) continue;
    found.set(line.createdAt, (found.get(line.createdAt) ?? 0) + 1);
  }
  return [...found.keys()]
    .sort()
    .map((createdAt, i) => ({ n: i + 1, status: "ok", found: found.get(createdAt)! }));
}

/** The newest `createdAt` among the shared lines waiting, or "" when there are none. */
export function newestShare(waiting: readonly Transaction[]) {
  return waiting.reduce(
    (top, line) => (line.importedVia === "share" && line.createdAt > top ? line.createdAt : top),
    ""
  );
}

/** The tray's heading for shared screenshots. */
export function shareHeading(shots: readonly Shot[]) {
  const lines = shots.reduce((sum, s) => sum + s.found, 0);
  return {
    title: `From your phone: read ${countLabel(shots.length, "screenshot")}`,
    sub: `Found ${countLabel(lines, "transaction")}.`,
  };
}
