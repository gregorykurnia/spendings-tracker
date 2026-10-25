// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Sheet, SheetBody, SheetFoot, SheetHead, nextFocus } from "./sheet";

afterEach(cleanup);

function Harness({ busy = false, onClose = () => {} }: { busy?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div id="app">
        <button onClick={() => setOpen(true)}>Open</button>
        <main id="main" tabIndex={-1}>
          page
        </main>
      </div>
      {open ? (
        <Sheet
          label="Spend"
          busy={busy}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        >
          <SheetHead title="Spend" />
          <SheetBody>
            <input aria-label="Store" />
          </SheetBody>
          <SheetFoot>
            <button>Save</button>
          </SheetFoot>
        </Sheet>
      ) : null}
    </>
  );
}

function openIt() {
  const opener = screen.getByText("Open");
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

const dialog = () => screen.getByRole("dialog");

describe("nextFocus", () => {
  const panel = document.createElement("div");
  const a = document.createElement("button");
  const b = document.createElement("button");
  const c = document.createElement("button");
  panel.append(a, b, c);
  document.body.append(panel);

  it("wraps from the last to the first, and from the first (or the panel) back to the last", () => {
    expect(nextFocus([a, b, c], c, panel, false)).toBe(a);
    expect(nextFocus([a, b, c], a, panel, true)).toBe(c);
    expect(nextFocus([a, b, c], panel, panel, true)).toBe(c);
  });
  it("leaves Tab alone in the middle", () => {
    expect(nextFocus([a, b, c], b, panel, false)).toBeNull();
    expect(nextFocus([a, b, c], b, panel, true)).toBeNull();
  });
  it("brings focus back when it has slipped outside", () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    expect(nextFocus([a, b, c], outside, panel, false)).toBe(a);
    expect(nextFocus([a, b, c], outside, panel, true)).toBe(c);
    expect(nextFocus([a, b, c], null, panel, false)).toBe(a);
  });
  it("keeps focus where it is when there is nothing to land on", () => {
    expect(nextFocus([], panel, panel, false)).toBe("stay");
  });
});

describe("Sheet", () => {
  it("moves focus in when it opens, and makes the page inert", () => {
    render(<Harness />);
    openIt();
    expect(document.activeElement).toBe(dialog());
    expect(dialog().getAttribute("aria-modal")).toBe("true");
    expect(dialog().getAttribute("aria-label")).toBe("Spend");
    expect((document.getElementById("app") as HTMLElement).inert).toBe(true);
  });

  it("keeps Tab inside: last to first, and Shift+Tab from the top to the last", () => {
    render(<Harness />);
    openIt();
    const close = screen.getByLabelText("Close");
    const save = screen.getByText("Save");

    save.focus();
    fireEvent.keyDown(save, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(save);
  });

  it("closes on Escape and puts focus back on what opened it", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = openIt();
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect((document.getElementById("app") as HTMLElement).inert).toBe(false);
  });

  it("closes from the close button and from a tap on the grey", () => {
    const onClose = vi.fn();
    const { container, unmount } = render(<Harness onClose={onClose} />);
    openIt();
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);

    openIt();
    const scrim = dialog().previousElementSibling as HTMLElement;
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(container).toBeTruthy();
    unmount();
  });

  it("can't be dismissed while busy, by any route", () => {
    const onClose = vi.fn();
    render(<Harness busy onClose={onClose} />);
    openIt();
    expect(dialog().getAttribute("aria-busy")).toBe("true");
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    fireEvent.click(screen.getByLabelText("Close"));
    fireEvent.click(dialog().previousElementSibling as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("falls back to the main area when what opened it is gone", () => {
    function Gone() {
      const [open, setOpen] = useState(false);
      const [showOpener, setShowOpener] = useState(true);
      return (
        <>
          <div id="app">
            {showOpener ? (
              <button
                onClick={() => {
                  setOpen(true);
                  setShowOpener(false);
                }}
              >
                Open
              </button>
            ) : null}
            <main id="main" tabIndex={-1}>
              page
            </main>
          </div>
          {open ? (
            <Sheet label="Spend" onClose={() => setOpen(false)}>
              <SheetHead title="Spend" />
            </Sheet>
          ) : null}
        </>
      );
    }
    render(<Gone />);
    const opener = screen.getByText("Open");
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(document.activeElement).toBe(document.getElementById("main"));
  });

  it("answers only in the top sheet when two are open", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    function Two() {
      const [a, setA] = useState(true);
      const [b, setB] = useState(true);
      return (
        <>
          <div id="app" />
          {a ? (
            <Sheet label="Outer" onClose={() => { outer(); setA(false); }}>
              <SheetHead title="Outer" />
            </Sheet>
          ) : null}
          {b ? (
            <Sheet label="Inner" onClose={() => { inner(); setB(false); }}>
              <SheetHead title="Inner" />
            </Sheet>
          ) : null}
        </>
      );
    }
    render(<Two />);
    act(() => {
      fireEvent.keyDown(document.body, { key: "Escape" });
    });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Outer" })).toBeTruthy();
    // The one left is no longer behind another, so it can be reached.
    expect((document.getElementById("app") as HTMLElement).inert).toBe(true);
  });
});
