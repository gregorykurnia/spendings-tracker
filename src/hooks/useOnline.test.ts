// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useOnline } from "./useOnline";

afterEach(() => vi.restoreAllMocks());

describe("useOnline", () => {
  it("follows the browser's connection", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { result, unmount } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    onLine.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);

    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
    unmount();
  });
});
