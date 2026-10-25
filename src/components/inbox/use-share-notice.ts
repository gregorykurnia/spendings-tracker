"use client";

import { useEffect, useState } from "react";
import type { Transaction } from "@/types";
import { newestShare, SHARE_SEEN_KEY, sharedShots } from "./share-notice";

function readSeen() {
  try {
    return typeof localStorage === "undefined" ? "" : (localStorage.getItem(SHARE_SEEN_KEY) ?? "");
  } catch {
    return "";
  }
}

/**
 * The shared screenshots this visit has news of: the ones that came in after the newest one shown on an
 * earlier visit. They are marked as shown straight away, so the next visit doesn't repeat them; this
 * visit keeps them while their lines are waiting.
 */
export function useShareNotice(waiting: readonly Transaction[]) {
  // Fixed for the visit, so the notice doesn't vanish the moment it is marked as shown.
  const [since] = useState(readSeen);
  const newest = newestShare(waiting);

  useEffect(() => {
    if (!newest || newest <= readSeen()) return;
    try {
      localStorage.setItem(SHARE_SEEN_KEY, newest);
    } catch {
      // Private browsing can refuse storage: the notice then shows again next time, which is harmless.
    }
  }, [newest]);

  return sharedShots(waiting, since);
}
