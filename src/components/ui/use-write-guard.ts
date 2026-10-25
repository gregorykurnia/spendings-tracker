"use client";

import { useOnline } from "@/hooks/useOnline";
import { NET_SHORT } from "@/lib/offline";
import { useToast } from "./toast";

/**
 * For a control that writes data. With no connection it is dimmed, and pressing it says why instead
 * of doing anything (design notes §4: offline, "dimmed, says why when pressed").
 */
export function useWriteGuard(writes: boolean | undefined) {
  const online = useOnline();
  const { toast, announce } = useToast();
  const blocked = Boolean(writes) && !online;

  function refuse() {
    toast(NET_SHORT);
    announce(NET_SHORT);
  }

  return { blocked, refuse };
}
