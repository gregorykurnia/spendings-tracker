"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readScreenshotFile, type ReadOutcome } from "@/lib/import-client";
import type { OcrLine } from "@/types";
import { shotAnnouncement, trayFinished, trayBusy, TRAY_CLEAR_MS, type Shot } from "./tray";

/** A screenshot in the tray: its file stays until it is read, so "Try again" can send it once more. */
export type TrayShot = Shot & {
  file: File;
  /** For the thumbnail; `null` where the browser can't make one. */
  url: string | null;
};

type Options = {
  /** Writes the lines read from one screenshot as waiting lines, and returns the `createdAt` they carry. */
  save: (lines: OcrLine[]) => Promise<string>;
  /** Tells screen readers (polite). */
  announce: (message: string) => void;
  /** Reads one screenshot; replaceable so a test needn't call the network. */
  read?: (file: File) => Promise<ReadOutcome>;
};

/** What this visit has brought in: how many screenshots gave lines, and the `createdAt` each batch carries. */
export type Fresh = { shots: number; stamps: ReadonlySet<string> };

function thumbnailUrl(file: File) {
  return typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;
}

function release(shots: readonly TrayShot[]) {
  for (const shot of shots) if (shot.url) URL.revokeObjectURL(shot.url);
}

/**
 * The import tray's state: screenshots are read one at a time, in the order they were added, and each
 * one's lines are saved as soon as it is read. A failed one stays for "Try again", "Type in a spend" or
 * "Dismiss"; a tray where every screenshot was read clears itself.
 */
export function useImportTray({ save, announce, read = readScreenshotFile }: Options) {
  const [shots, setShots] = useState<TrayShot[]>([]);
  const [fresh, setFresh] = useState<Fresh>({ shots: 0, stamps: new Set() });
  // The list as the next step sees it: every change goes through `commit`, which also renders it.
  const list = useRef<TrayShot[]>([]);
  // The screenshot being read (its number), so only one is in flight even if the effect runs twice.
  const active = useRef<number | null>(null);
  const latest = useRef({ save, announce, read });

  useEffect(() => {
    latest.current = { save, announce, read };
  });

  const commit = useCallback((next: TrayShot[]) => {
    list.current = next;
    setShots(next);
  }, []);

  const change = useCallback(
    (n: number, patch: Partial<TrayShot>) => commit(list.current.map((s) => (s.n === n ? { ...s, ...patch } : s))),
    [commit]
  );

  const run = useCallback(
    async (shot: TrayShot) => {
      const { save, announce, read } = latest.current;
      let outcome: ReadOutcome;
      let stamp = "";
      try {
        outcome = await read(shot.file);
      } catch {
        outcome = { kind: "fail" };
      }
      if (outcome.kind === "lines") {
        try {
          // A write with no connection would wait for one without ever ending.
          if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("offline");
          stamp = await save(outcome.lines);
        } catch (err) {
          console.error("saving a screenshot's lines failed:", err);
          outcome = { kind: "fail" };
        }
      }
      const done: Pick<TrayShot, "status" | "found"> =
        outcome.kind === "lines"
          ? { status: "ok", found: outcome.lines.length }
          : { status: outcome.kind === "empty" ? "empty" : "fail", found: 0 };
      active.current = null;
      if (outcome.kind === "lines") {
        setFresh((now) => ({ shots: now.shots + 1, stamps: new Set(now.stamps).add(stamp) }));
      }
      change(shot.n, done);
      announce(shotAnnouncement({ n: shot.n, ...done }));
    },
    [change]
  );

  // Starts the next screenshot whenever none is being read.
  useEffect(() => {
    if (active.current !== null) return;
    const next = shots.find((s) => s.status === "wait");
    if (!next) return;
    active.current = next.n;
    change(next.n, { status: "reading" });
    void run(next);
  }, [shots, change, run]);

  // A tray where everything was read is only there to say so.
  useEffect(() => {
    if (!trayFinished(shots)) return;
    const timer = setTimeout(() => {
      release(list.current);
      commit([]);
    }, TRAY_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [shots, commit]);

  useEffect(
    () => () => {
      release(list.current);
    },
    []
  );

  /** Adds screenshots to the tray. Ones already read are dropped; ones that failed stay. */
  const add = useCallback(
    (files: readonly File[]) => {
      if (!files.length) return;
      const kept = list.current.filter((s) => s.status !== "ok");
      release(list.current.filter((s) => s.status === "ok"));
      const first = kept.reduce((top, s) => Math.max(top, s.n), 0) + 1;
      commit([
        ...kept,
        ...files.map((file, i): TrayShot => ({
          n: first + i,
          status: "wait",
          found: 0,
          file,
          url: thumbnailUrl(file),
        })),
      ]);
    },
    [commit]
  );

  const retry = useCallback(
    (n: number) => {
      if (list.current.some((s) => s.n === n && s.status === "fail")) change(n, { status: "wait" });
    },
    [change]
  );

  const dismiss = useCallback(
    (n: number) => {
      release(list.current.filter((s) => s.n === n));
      commit(list.current.filter((s) => s.n !== n));
    },
    [commit]
  );

  return { shots, fresh, busy: trayBusy(shots), add, retry, dismiss };
}
