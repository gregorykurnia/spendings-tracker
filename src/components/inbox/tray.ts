// The import tray's words and rules, apart from its markup: one row per screenshot, and a heading that
// says how the batch is going.

import { countLabel } from "@/lib/money";

export type ShotStatus = "wait" | "reading" | "ok" | "fail" | "empty";

/** What the tray needs to know about a screenshot. `found` is how many lines it gave. */
export type Shot = { n: number; status: ShotStatus; found: number };

/** How long a finished tray (every screenshot read) stays before it clears itself. */
export const TRAY_CLEAR_MS = 2600;

/** Still waiting or being read: "Add" is off and the tray says to keep the page open. */
export function trayBusy(shots: readonly Pick<Shot, "status">[]) {
  return shots.some((s) => s.status === "wait" || s.status === "reading");
}

/** Every screenshot was read and gave lines: nothing left in the tray to act on. */
export function trayFinished(shots: readonly Pick<Shot, "status">[]) {
  return shots.length > 0 && shots.every((s) => s.status === "ok");
}

const found = (n: number) => `Found ${countLabel(n, "transaction")}`;

/** The tray's heading and the line under it. */
export function trayHeading(shots: readonly Shot[]): { title: string; sub: string } {
  const total = shots.length;
  const read = shots.filter((s) => s.status === "ok");
  const lines = shots.reduce((sum, s) => sum + s.found, 0);
  if (trayBusy(shots)) {
    return { title: `Reading ${countLabel(total, "screenshot")}`, sub: "Keep this open until it's done." };
  }
  if (read.length === total) {
    return {
      title: total > 1 ? `Read all ${total} screenshots` : "Read the screenshot",
      sub: `${found(lines)}.`,
    };
  }
  if (read.length > 0) {
    return {
      title: `Read ${read.length} of ${total} screenshots`,
      sub: `${found(lines)}. The rest need you.`,
    };
  }
  return { title: "Nothing added", sub: `Retake ${total > 1 ? "them" : "it"}, or type the spends in.` };
}

/** What a row says about its screenshot. */
export function shotState(shot: Shot) {
  switch (shot.status) {
    case "wait":
      return "Waiting";
    case "reading":
      return "Reading…";
    case "ok":
      return shot.found ? found(shot.found) : "Read";
    case "fail":
      return "Couldn't read this one";
    case "empty":
      return "Nothing found";
  }
}

/** The line under a failed or empty row. */
export function shotDetail(status: "fail" | "empty") {
  return status === "fail"
    ? "It may be blurry or cut off. Retake it, or type the spends in."
    : "This screenshot has no transactions. It needs to show the list of spending.";
}

/** Said to screen readers when a screenshot's reading ends. */
export function shotAnnouncement(shot: Shot) {
  if (shot.status === "ok") return `Screenshot ${shot.n} read. ${found(shot.found)}.`;
  if (shot.status === "fail") return `Screenshot ${shot.n} couldn't be read.`;
  return `Screenshot ${shot.n} has no transactions.`;
}
