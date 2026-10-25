// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NET_SHORT } from "@/lib/offline";
import { Button } from "./button";
import { Chip } from "./chip";
import { ToastProvider } from "./toast";

const online = vi.hoisted(() => ({ value: true }));
vi.mock("@/hooks/useOnline", () => ({ useOnline: () => online.value }));

afterEach(() => {
  cleanup();
  online.value = true;
  vi.useRealTimers();
});

describe("Button", () => {
  it("runs its action", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Accept</Button>);
    fireEvent.click(screen.getByText("Accept"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does nothing while not ready, and stays reachable by keyboard", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>
    );
    const button = screen.getByText("Save");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows the verb in progress while busy, and does nothing", () => {
    const onClick = vi.fn();
    render(
      <Button busy busyLabel="Saving…" onClick={onClick}>
        Save
      </Button>
    );
    const button = screen.getByText("Saving…").closest("button") as HTMLElement;
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByText("Save")).toBeNull();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("says why instead of writing when there is no connection", () => {
    vi.useFakeTimers();
    online.value = false;
    const onClick = vi.fn();
    render(
      <ToastProvider>
        <Button writes onClick={onClick}>
          Accept all 5
        </Button>
        <Button onClick={onClick}>Look around</Button>
      </ToastProvider>
    );
    fireEvent.click(screen.getByText("Accept all 5"));
    expect(onClick).not.toHaveBeenCalled();
    expect(document.getElementById("toast")?.textContent).toBe(NET_SHORT);
    act(() => vi.advanceTimersByTime(30));
    expect(document.getElementById("live")?.textContent).toBe(NET_SHORT);

    // A button that doesn't write works as usual.
    fireEvent.click(screen.getByText("Look around"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Chip", () => {
  it("is a toggle when told whether it is on", () => {
    render(
      <>
        <Chip on>Food</Chip>
        <Chip on={false}>Travel</Chip>
        <Chip>More</Chip>
      </>
    );
    expect(screen.getByText("Food").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Travel").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("More").hasAttribute("aria-pressed")).toBe(false);
  });

  it("does not write offline, and says why", () => {
    online.value = false;
    const onClick = vi.fn();
    render(
      <ToastProvider>
        <Chip writes onClick={onClick}>
          Food
        </Chip>
      </ToastProvider>
    );
    fireEvent.click(screen.getByText("Food"));
    expect(onClick).not.toHaveBeenCalled();
    expect(document.getElementById("toast")?.textContent).toBe(NET_SHORT);
  });
});
