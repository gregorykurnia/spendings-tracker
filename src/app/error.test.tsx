// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast";

const nav = vi.hoisted(() => ({ path: "/spending" }));

vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import AppError from "./error";

// The page sits inside the app's toast provider, as it does in the app shell.
function renderError(path: string, error: Error, retry = vi.fn()) {
  nav.path = path;
  render(
    <ToastProvider>
      <AppError error={error} unstable_retry={retry} />
    </ToastProvider>
  );
  return retry;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the unexpected-error screen", () => {
  it("says what is safe, offers Try again and a way home, and keeps the error's own text off the screen", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("internal detail that must stay off the screen");
    const retry = renderError("/spending", error);

    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeTruthy();
    expect(screen.getByText("What you saved is safe. Try again in a moment.")).toBeTruthy();
    expect(screen.queryByText(/internal detail/)).toBeNull();
    expect(logged).toHaveBeenCalledWith(error);
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("keeps the bar of the screen it happened on", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    renderError("/", new Error("x"));
    expect(screen.getByRole("link", { name: "Daybook" })).toBeTruthy();
    cleanup();

    renderError("/spending", new Error("x"));
    expect(screen.getByRole("link", { name: "Home" })).toBeTruthy();
  });
});
