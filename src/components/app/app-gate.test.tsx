// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// The gate is tested with the data hooks and the router replaced, so each state can be set by hand.
const data = vi.hoisted(() => ({
  path: "/",
  online: true,
  cats: { categories: [] as unknown[], loading: true, error: null as string | null, seeding: null as { done: number; total: number } | null },
  tx: { loading: true, error: null as string | null },
  mounts: 0,
}));

vi.mock("next/navigation", () => ({ usePathname: () => data.path }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/useOnline", () => ({ useOnline: () => data.online }));
// `mounts` counts the times the data hooks start from scratch: one per mount of the gate's inner part.
vi.mock("@/hooks/useCategories", async () => {
  const { useEffect } = await import("react");
  return {
    useCategories: () => {
      useEffect(() => {
        data.mounts++;
      }, []);
      return data.cats;
    },
  };
});
vi.mock("@/hooks/useTransactions", () => ({ useTransactions: () => data.tx }));

import AppGate, { RETRY_FEEDBACK_MS, STILL_OFFLINE } from "./app-gate";

const SIXTEEN = Array.from({ length: 16 }, (_, i) => ({ id: String(i) }));

function readyData() {
  data.cats = { categories: SIXTEEN, loading: false, error: null, seeding: null };
  data.tx = { loading: false, error: null };
}

function show() {
  return render(
    <AppGate>
      <p>the screen</p>
    </AppGate>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  data.path = "/";
  data.online = true;
  data.mounts = 0;
  data.cats = { categories: [], loading: true, error: null, seeding: null };
  data.tx = { loading: true, error: null };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AppGate", () => {
  it("shows the screen's loading layout, then the screen", () => {
    const { rerender } = show();
    expect(screen.getByText("Loading your transactions")).toBeTruthy();
    expect(screen.queryByText("the screen")).toBeNull();

    readyData();
    rerender(
      <AppGate>
        <p>the screen</p>
      </AppGate>
    );
    expect(screen.getByText("the screen")).toBeTruthy();
    expect(screen.queryByText("Loading your transactions")).toBeNull();
  });

  it("loads each screen in its own layout", () => {
    data.path = "/categories";
    show();
    expect(screen.getByText("Loading your categories")).toBeTruthy();
  });

  it("shows the setting-up count on the first open", () => {
    data.cats = { categories: SIXTEEN.slice(0, 9), loading: false, error: null, seeding: { done: 9, total: 16 } };
    show();
    expect(screen.getByRole("heading", { name: "Setting up" })).toBeTruthy();
    expect(screen.getByText("9 of 16")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("9");
  });

  it("leaves other paths alone, without asking for data", () => {
    data.path = "/not-here";
    show();
    expect(screen.getByText("the screen")).toBeTruthy();
    expect(data.mounts).toBe(0);
  });

  it("says what failed, with no raw error text, and tries again on request", () => {
    readyData();
    data.tx = { loading: false, error: "PERMISSION_DENIED: missing or insufficient permissions" };
    show();
    expect(screen.getByRole("heading", { name: "Couldn’t load your transactions" })).toBeTruthy();
    expect(screen.queryByText(/PERMISSION_DENIED/)).toBeNull();
    const before = data.mounts;

    readyData(); // the next try works
    fireEvent.click(screen.getByText("Try again"));
    // The data hooks start over, and "Trying again…" shows for a moment.
    expect(data.mounts).toBe(before + 1);
    const trying = screen.getByText("Trying again…").closest("button") as HTMLElement;
    expect(trying.getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByText("the screen")).toBeNull();

    act(() => vi.advanceTimersByTime(RETRY_FEEDBACK_MS));
    expect(screen.getByText("the screen")).toBeTruthy();
  });

  it("goes back to Try again when the retry fails too", () => {
    readyData();
    data.tx = { loading: false, error: "boom" };
    show();
    fireEvent.click(screen.getByText("Try again"));
    act(() => vi.advanceTimersByTime(RETRY_FEEDBACK_MS));
    expect(screen.getByText("Try again")).toBeTruthy();
    expect(screen.queryByText("Trying again…")).toBeNull();
  });

  it("says there is no connection when opened offline, and when a retry finds none", () => {
    data.online = false;
    show();
    expect(screen.getByRole("heading", { name: "No connection" })).toBeTruthy();
    expect(screen.queryByText(STILL_OFFLINE)).toBeNull();

    fireEvent.click(screen.getByText("Try again"));
    expect(screen.getByText("Trying again…")).toBeTruthy();
    act(() => vi.advanceTimersByTime(RETRY_FEEDBACK_MS));
    expect(screen.getByText(STILL_OFFLINE).getAttribute("role")).toBe("status");
  });

  it("keeps the screen, with a notice, when the connection drops after it loaded", () => {
    readyData();
    data.online = false;
    show();
    expect(screen.getByText("the screen")).toBeTruthy();
  });

  it("tries again by itself when the connection comes back after a failure", () => {
    data.online = false;
    data.cats = { categories: [], loading: false, error: "unavailable", seeding: null };
    data.tx = { loading: false, error: null };
    const { rerender } = show();
    expect(screen.getByRole("heading", { name: "No connection" })).toBeTruthy();
    const before = data.mounts;

    // Back online: the failure from the offline try is still there, so the gate retries.
    data.online = true;
    readyData();
    data.cats = { ...data.cats, error: "unavailable" };
    rerender(
      <AppGate>
        <p>the screen</p>
      </AppGate>
    );
    expect(data.mounts).toBe(before + 1);
  });

  it("does not retry by itself when it comes back online and nothing failed", () => {
    data.online = false;
    const { rerender } = show();
    const before = data.mounts;
    data.online = true;
    rerender(
      <AppGate>
        <p>the screen</p>
      </AppGate>
    );
    expect(data.mounts).toBe(before);
    expect(screen.getByText("Loading your transactions")).toBeTruthy();
  });
});
