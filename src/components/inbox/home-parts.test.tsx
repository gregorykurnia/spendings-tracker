// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast";
import { NET_SHORT } from "@/lib/offline";
import { AddButton } from "./add-button";
import { EmptyPanel } from "./empty-panel";
import { GlanceCard } from "./glance-card";
import { HomeLinks } from "./home-links";
import { ImportTray } from "./import-tray";
import type { TrayShot } from "./use-import-tray";

const online = vi.hoisted(() => ({ value: true }));
vi.mock("@/hooks/useOnline", () => ({ useOnline: () => online.value }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  online.value = true;
});

const shot = (n: number, status: TrayShot["status"], found = 0): TrayShot => ({
  n,
  status,
  found,
  file: new File(["x"], `${n}.png`),
  url: null,
});

const toastText = () => document.getElementById("toast")?.textContent;

describe("the Add button", () => {
  it("opens the picker", () => {
    const onPress = vi.fn();
    render(
      <ToastProvider>
        <AddButton onPress={onPress} reading={false} short />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Add screenshots" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is off while screenshots are being read", () => {
    const onPress = vi.fn();
    render(
      <ToastProvider>
        <AddButton onPress={onPress} reading />
      </ToastProvider>
    );
    const button = screen.getByRole("button", { name: "Add screenshots" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("says why it does nothing with no connection", () => {
    online.value = false;
    const onPress = vi.fn();
    render(
      <ToastProvider>
        <AddButton onPress={onPress} reading={false} />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Add screenshots" }));
    expect(onPress).not.toHaveBeenCalled();
    expect(toastText()).toBe(NET_SHORT);
  });
});

describe("the import tray", () => {
  const handlers = () => ({ onRetry: vi.fn(), onDismiss: vi.fn(), onTypeIn: vi.fn() });

  it("shows a row per screenshot, with a progress bar on the one being read", () => {
    render(
      <ToastProvider>
        <ImportTray shots={[shot(1, "ok", 3), shot(2, "reading"), shot(3, "wait")]} {...handlers()} />
      </ToastProvider>
    );
    expect(screen.getByRole("heading", { name: "Reading 3 screenshots" })).toBeTruthy();
    expect(screen.getByText("Keep this open until it's done.")).toBeTruthy();
    expect(screen.getByText("Found 3 transactions")).toBeTruthy();
    expect(screen.getByText("Waiting")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Reading screenshot 2" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers Try again, Type in a spend and Dismiss on a failed one, and the last two on an empty one", () => {
    const h = handlers();
    render(
      <ToastProvider>
        <ImportTray shots={[shot(1, "fail"), shot(2, "empty")]} {...h} />
      </ToastProvider>
    );
    expect(screen.getByText("Couldn't read this one")).toBeTruthy();
    expect(screen.getByText("Nothing found")).toBeTruthy();
    const rows = screen.getAllByRole("listitem");
    fireEvent.click(within(rows[0]).getByRole("button", { name: "Try again" }));
    expect(h.onRetry).toHaveBeenCalledWith(1);
    fireEvent.click(within(rows[1]).getByRole("button", { name: "Dismiss" }));
    expect(h.onDismiss).toHaveBeenCalledWith(2);
    fireEvent.click(within(rows[1]).getByRole("button", { name: "Type in a spend" }));
    expect(h.onTypeIn).toHaveBeenCalledTimes(1);
    expect(within(rows[1]).queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("dims Try again with no connection and says why when it is pressed", () => {
    online.value = false;
    const h = handlers();
    render(
      <ToastProvider>
        <ImportTray shots={[shot(1, "fail")]} {...h} />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(h.onRetry).not.toHaveBeenCalled();
    expect(toastText()).toBe(NET_SHORT);
  });
});

describe("the empty panels", () => {
  it("says everything is checked, with both ways in", () => {
    const onTypeInSpend = vi.fn();
    render(
      <ToastProvider>
        <EmptyPanel firstUse={false} add={<button type="button">Add screenshots</button>} onTypeInSpend={onTypeInSpend} />
      </ToastProvider>
    );
    expect(
      screen.getByText("Add screenshots from your banking app and the spending in them shows up here to check.")
    ).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Type in a spend" }));
    expect(onTypeInSpend).toHaveBeenCalledTimes(1);
  });

  it("walks through three steps on first use", () => {
    render(
      <ToastProvider>
        <EmptyPanel firstUse add={<button type="button">Add screenshots</button>} onTypeInSpend={() => {}} />
      </ToastProvider>
    );
    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps.map((s) => s.textContent)).toEqual([
      "1Take a screenshot of your transactions in the banking app.",
      "2Add it here. It is read for you.",
      "3Check what was found, then accept it.",
    ]);
    expect(screen.getByRole("button", { name: "Add screenshots" })).toBeTruthy();
  });
});

describe("the glance card and the links", () => {
  it("links the card to Spending with the month so far, written out for a screen reader", () => {
    render(<GlanceCard today="2026-10-25" spends={[{ id: "a", date: "2026-10-03", amount: 128_000, categoryId: "x" }]} />);
    const link = screen.getByRole("link", { name: /^October so far\s*Rp\s*128\.000\s*Nothing in 1 to 25 September to compare with\. Open spending\.$/ });
    expect(link.getAttribute("href")).toBe("/spending");
    expect(link.textContent).toContain("128.000");
  });

  it("links the other three places and types a spend in", () => {
    const onTypeInSpend = vi.fn();
    render(<HomeLinks onTypeInSpend={onTypeInSpend} />);
    const nav = screen.getByRole("navigation", { name: "More" });
    expect(within(nav).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/spending",
      "/transactions",
      "/categories",
    ]);
    fireEvent.click(within(nav).getByRole("button", { name: /Type in a spend/ }));
    expect(onTypeInSpend).toHaveBeenCalledTimes(1);
  });
});
