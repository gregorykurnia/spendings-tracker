// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { TOAST_MS, ToastProvider, useToast } from "./toast";

function Buttons() {
  const { toast, announce } = useToast();
  return (
    <>
      <button onClick={() => toast("Deleted KOPI. ")}>toast</button>
      <button onClick={() => toast("Added.")}>second</button>
      <button onClick={() => announce("Accepted 5.")}>announce</button>
    </>
  );
}

function press(name: string) {
  const button = [...document.querySelectorAll("button")].find((b) => b.textContent === name);
  act(() => button?.click());
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("toast", () => {
  it("shows one line and takes it away after four seconds", () => {
    render(
      <ToastProvider>
        <Buttons />
      </ToastProvider>
    );
    const toast = document.getElementById("toast") as HTMLElement;
    expect(toast.dataset.shown).toBe("false");

    press("toast");
    expect(toast.textContent).toBe("Deleted KOPI. ");
    expect(toast.dataset.shown).toBe("true");

    act(() => vi.advanceTimersByTime(TOAST_MS - 1));
    expect(toast.dataset.shown).toBe("true");
    act(() => vi.advanceTimersByTime(1));
    expect(toast.dataset.shown).toBe("false");
  });

  it("restarts the clock when a second toast replaces the first", () => {
    render(
      <ToastProvider>
        <Buttons />
      </ToastProvider>
    );
    const toast = document.getElementById("toast") as HTMLElement;
    press("toast");
    act(() => vi.advanceTimersByTime(TOAST_MS - 500));
    press("second");
    expect(toast.textContent).toBe("Added.");
    act(() => vi.advanceTimersByTime(TOAST_MS - 1));
    expect(toast.dataset.shown).toBe("true");
    act(() => vi.advanceTimersByTime(1));
    expect(toast.dataset.shown).toBe("false");
  });

  it("is a status the screen reader hears, and announcements go to the polite live region", () => {
    render(
      <ToastProvider>
        <Buttons />
      </ToastProvider>
    );
    expect(document.getElementById("toast")?.getAttribute("role")).toBe("status");
    const live = document.getElementById("live") as HTMLElement;
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("");

    press("announce");
    // Emptied first, then filled, so the same words twice are read twice.
    expect(live.textContent).toBe("");
    act(() => vi.advanceTimersByTime(30));
    expect(live.textContent).toBe("Accepted 5.");

    press("announce");
    expect(live.textContent).toBe("");
    act(() => vi.advanceTimersByTime(30));
    expect(live.textContent).toBe("Accepted 5.");
  });

  it("does nothing without a provider, so a part can be shown on its own", () => {
    function Alone() {
      useToast().toast("x");
      return null;
    }
    expect(() => render(<Alone />)).not.toThrow();
  });
});
