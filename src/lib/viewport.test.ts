import { describe, expect, it } from "vitest";
import { viewportInsets } from "./viewport";

const base = { innerHeight: 926, offsetTop: 0, height: 926, scale: 1, typing: false };

describe("viewportInsets", () => {
  it("is zero when the page and the screen line up", () => {
    expect(viewportInsets(base)).toEqual({ top: 0, bottom: 0 });
  });

  it("moves the layers down by a shift the keyboard left behind", () => {
    expect(viewportInsets({ ...base, offsetTop: 250 })).toEqual({ top: 250, bottom: -250 });
  });

  it("stretches the layers past a page that reads shorter than the screen", () => {
    expect(viewportInsets({ ...base, innerHeight: 879, height: 926 })).toEqual({ top: 0, bottom: -47 });
  });

  it("leaves the layers alone while typing or zoomed", () => {
    expect(viewportInsets({ ...base, offsetTop: 250, typing: true })).toEqual({ top: 0, bottom: 0 });
    expect(viewportInsets({ ...base, offsetTop: 250, height: 463, scale: 2 })).toEqual({ top: 0, bottom: 0 });
  });

  it("treats a pixel of rounding as no shift", () => {
    expect(viewportInsets({ ...base, offsetTop: 0.6, height: 925.2 })).toEqual({ top: 0, bottom: 0 });
  });
});
