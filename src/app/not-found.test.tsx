// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import NotFound from "./not-found";

afterEach(cleanup);

describe("the unknown-address screen", () => {
  it("says the address isn't there and offers one way home, with no bar", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: "Nothing at this address" })).toBeTruthy();
    expect(screen.getByText("The link may be old or mistyped.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
    expect(screen.queryByRole("link", { name: "Search" })).toBeNull();
  });
});
