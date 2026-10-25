// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReadOutcome } from "@/lib/import-client";
import type { OcrLine } from "@/types";
import { TRAY_CLEAR_MS } from "./tray";
import { useImportTray } from "./use-import-tray";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const line = (store: string): OcrLine => ({
  date: "2026-10-24",
  store,
  description: "",
  amount: 28000,
  amountText: "28.000,00 DB",
  direction: "out",
  ownTransfer: false,
});

const file = (name: string) => new File(["x"], name, { type: "image/png" });

type Gate = { name: string; settle: (outcome: ReadOutcome) => void };

/** A reader the test settles by hand, one screenshot at a time. */
function setup() {
  const gates: Gate[] = [];
  const read = vi.fn(
    (f: File) =>
      new Promise<ReadOutcome>((resolve) => {
        gates.push({ name: f.name, settle: resolve });
      })
  );
  let stamps = 0;
  const save = vi.fn<(lines: OcrLine[]) => Promise<string>>(async () => `stamp-${++stamps}`);
  const announce = vi.fn();
  const hook = renderHook(() => useImportTray({ save, announce, read }));
  return { gates, read, save, announce, hook };
}

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

const statuses = (h: ReturnType<typeof setup>["hook"]) => h.result.current.shots.map((s) => s.status);

describe("the import tray", () => {
  it("reads one screenshot at a time, in the order added, saving each one's lines as it is read", async () => {
    const { gates, read, save, announce, hook } = setup();
    act(() => hook.result.current.add([file("a.png"), file("b.png"), file("c.png")]));
    await flush();

    expect(statuses(hook)).toEqual(["reading", "wait", "wait"]);
    expect(hook.result.current.busy).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);

    gates[0].settle({ kind: "lines", lines: [line("A1"), line("A2")] });
    await flush();
    expect(save).toHaveBeenCalledWith([line("A1"), line("A2")]);
    expect(statuses(hook)).toEqual(["ok", "reading", "wait"]);
    expect(hook.result.current.shots[0].found).toBe(2);
    expect(announce).toHaveBeenLastCalledWith("Screenshot 1 read. Found 2 transactions.");

    gates[1].settle({ kind: "fail" });
    await flush();
    expect(statuses(hook)).toEqual(["ok", "fail", "reading"]);
    expect(announce).toHaveBeenLastCalledWith("Screenshot 2 couldn't be read.");

    gates[2].settle({ kind: "empty" });
    await flush();
    expect(statuses(hook)).toEqual(["ok", "fail", "empty"]);
    expect(hook.result.current.busy).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("sends a failed screenshot again on 'Try again'", async () => {
    const { gates, read, save, hook } = setup();
    act(() => hook.result.current.add([file("a.png")]));
    await flush();
    gates[0].settle({ kind: "fail" });
    await flush();
    expect(statuses(hook)).toEqual(["fail"]);

    act(() => hook.result.current.retry(1));
    await flush();
    expect(statuses(hook)).toEqual(["reading"]);
    expect(read).toHaveBeenCalledTimes(2);
    gates[1].settle({ kind: "lines", lines: [line("A1")] });
    await flush();
    expect(statuses(hook)).toEqual(["ok"]);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("only retries one that failed", async () => {
    const { gates, read, hook } = setup();
    act(() => hook.result.current.add([file("a.png")]));
    await flush();
    gates[0].settle({ kind: "empty" });
    await flush();
    act(() => hook.result.current.retry(1));
    await flush();
    expect(statuses(hook)).toEqual(["empty"]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("counts a screenshot whose lines couldn't be saved as one that couldn't be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { gates, save, hook } = setup();
    save.mockRejectedValueOnce(new Error("write failed"));
    act(() => hook.result.current.add([file("a.png")]));
    await flush();
    gates[0].settle({ kind: "lines", lines: [line("A1")] });
    await flush();
    expect(statuses(hook)).toEqual(["fail"]);
    expect(hook.result.current.shots[0].found).toBe(0);
  });

  it("dismisses a row", async () => {
    const { gates, hook } = setup();
    act(() => hook.result.current.add([file("a.png")]));
    await flush();
    gates[0].settle({ kind: "empty" });
    await flush();
    act(() => hook.result.current.dismiss(1));
    expect(hook.result.current.shots).toEqual([]);
  });

  it("keeps a failed screenshot when more are added, drops the ones already read, and numbers on", async () => {
    const { gates, hook } = setup();
    act(() => hook.result.current.add([file("a.png"), file("b.png")]));
    await flush();
    gates[0].settle({ kind: "lines", lines: [line("A1")] });
    await flush();
    gates[1].settle({ kind: "fail" });
    await flush();

    act(() => hook.result.current.add([file("c.png")]));
    await flush();
    expect(hook.result.current.shots.map((s) => [s.n, s.status])).toEqual([
      [2, "fail"],
      [3, "reading"],
    ]);
  });

  it("clears itself a moment after every screenshot was read, but not while one needs the owner", async () => {
    const { gates, hook } = setup();
    act(() => hook.result.current.add([file("a.png")]));
    await flush();
    gates[0].settle({ kind: "lines", lines: [line("A1")] });
    await flush();
    expect(hook.result.current.shots).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRAY_CLEAR_MS);
    });
    expect(hook.result.current.shots).toEqual([]);

    act(() => hook.result.current.add([file("b.png")]));
    await flush();
    gates[1].settle({ kind: "fail" });
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TRAY_CLEAR_MS * 3);
    });
    expect(statuses(hook)).toEqual(["fail"]);
  });

  it("notes which screenshots gave lines, and the stamp each batch of lines carries", async () => {
    const { gates, hook } = setup();
    act(() => hook.result.current.add([file("a.png"), file("b.png"), file("c.png")]));
    await flush();
    gates[0].settle({ kind: "lines", lines: [line("A1")] });
    await flush();
    gates[1].settle({ kind: "fail" });
    await flush();
    gates[2].settle({ kind: "lines", lines: [line("C1")] });
    await flush();
    expect(hook.result.current.fresh.shots).toBe(2);
    expect([...hook.result.current.fresh.stamps]).toEqual(["stamp-1", "stamp-2"]);
  });

  it("does nothing for an empty choice", () => {
    const { hook } = setup();
    act(() => hook.result.current.add([]));
    expect(hook.result.current.shots).toEqual([]);
  });
});
