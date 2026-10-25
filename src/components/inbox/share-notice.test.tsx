// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import type { Transaction } from "@/types";
import { ImportTray } from "./import-tray";
import { newestShare, SHARE_SEEN_KEY, shareHeading, sharedShots } from "./share-notice";
import { useShareNotice } from "./use-share-notice";

function line(createdAt: string, extra: Partial<Transaction> = {}): Transaction {
  return {
    id: `${createdAt}-${Math.random()}`,
    amount: 10_000,
    store: "Shop",
    description: "",
    categoryId: "",
    date: "2026-10-24",
    source: "ocr",
    status: "pending_review",
    createdAt,
    importedVia: "share",
    ...extra,
  };
}

const A = "2026-10-24T08:00:00.000Z";
const B = "2026-10-24T09:00:00.000Z";
const C = "2026-10-24T10:00:00.000Z";
const waiting = [line(B), line(A), line(B), line(C, { importedVia: undefined }), line(B)];

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("sharedShots", () => {
  it("makes one finished row per shared screenshot after the mark, oldest first", () => {
    expect(sharedShots(waiting, "")).toEqual([
      { n: 1, status: "ok", found: 1 },
      { n: 2, status: "ok", found: 3 },
    ]);
    expect(sharedShots(waiting, A)).toEqual([{ n: 1, status: "ok", found: 3 }]);
    expect(sharedShots(waiting, B)).toEqual([]);
  });

  it("knows the newest shared batch", () => {
    expect(newestShare(waiting)).toBe(B);
    expect(newestShare([line(C, { importedVia: undefined })])).toBe("");
  });

  it("says where they came from, in the finished import's words", () => {
    expect(shareHeading(sharedShots(waiting, ""))).toEqual({
      title: "From your phone: read 2 screenshots",
      sub: "Found 4 transactions.",
    });
    expect(shareHeading([{ n: 1, status: "ok", found: 1 }])).toEqual({
      title: "From your phone: read 1 screenshot",
      sub: "Found 1 transaction.",
    });
  });
});

describe("useShareNotice", () => {
  it("shows a batch once: this visit keeps it, the next visit doesn't", () => {
    localStorage.setItem(SHARE_SEEN_KEY, A);
    const first = renderHook(() => useShareNotice(waiting));
    expect(first.result.current).toHaveLength(1);
    expect(localStorage.getItem(SHARE_SEEN_KEY)).toBe(B);
    first.rerender();
    expect(first.result.current).toHaveLength(1);

    const next = renderHook(() => useShareNotice(waiting));
    expect(next.result.current).toEqual([]);
  });
});

describe("the tray for shared screenshots", () => {
  it("shows the given heading and a finished row per screenshot", () => {
    const shots = sharedShots(waiting, "");
    const noop = () => {};
    render(
      <ImportTray shots={shots} heading={shareHeading(shots)} onRetry={noop} onDismiss={noop} onTypeIn={noop} />
    );
    expect(screen.getByRole("heading", { name: "From your phone: read 2 screenshots" })).toBeTruthy();
    expect(screen.getByText("Found 4 transactions.")).toBeTruthy();
    expect(screen.getByText("Found 3 transactions")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
