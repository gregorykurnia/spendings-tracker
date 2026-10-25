import { describe, expect, it } from "vitest";
import { bootState, screenFor, type BootInput } from "./boot";

const ready: BootInput = {
  screen: "home",
  online: true,
  categories: { loading: false, error: null, count: 16 },
  seeding: null,
  transactions: { loading: false, error: null },
};

function input(change: Partial<BootInput> = {}): BootInput {
  return { ...ready, ...change };
}

describe("screenFor", () => {
  it("knows the four screens, with or without a trailing slash", () => {
    expect(screenFor("/")).toBe("home");
    expect(screenFor("/spending")).toBe("spending");
    expect(screenFor("/transactions")).toBe("transactions");
    expect(screenFor("/categories/")).toBe("categories");
  });
  it("leaves every other path alone", () => {
    expect(screenFor("/nope")).toBeNull();
    expect(screenFor("/ocr")).toBeNull();
    expect(screenFor("/spending/extra")).toBeNull();
    expect(screenFor(null)).toBeNull();
  });
});

describe("bootState", () => {
  it("is ready when everything is here", () => {
    expect(bootState(input())).toEqual({ kind: "ready" });
  });

  it("shows the setting-up count while the starter categories go in", () => {
    const state = bootState(
      input({
        seeding: { done: 9, total: 16 },
        categories: { loading: false, error: null, count: 9 },
        transactions: { loading: true, error: null },
      })
    );
    expect(state).toEqual({ kind: "setup", done: 9, total: 16 });
  });

  it("loads while either list is still coming", () => {
    expect(bootState(input({ categories: { loading: true, error: null, count: 0 } }))).toEqual({
      kind: "loading",
    });
    expect(bootState(input({ transactions: { loading: true, error: null } }))).toEqual({
      kind: "loading",
    });
  });

  it("lets Categories open without waiting for transactions", () => {
    const state = bootState(
      input({ screen: "categories", transactions: { loading: true, error: null } })
    );
    expect(state).toEqual({ kind: "ready" });
  });

  it("names what failed, starting with what the screen is about", () => {
    const tx = { loading: false, error: "boom" };
    const cats = { loading: false, error: "boom", count: 16 };
    expect(bootState(input({ transactions: tx }))).toEqual({ kind: "failed", what: "transactions" });
    expect(bootState(input({ categories: cats }))).toEqual({ kind: "failed", what: "categories" });
    expect(bootState(input({ categories: cats, transactions: tx }))).toEqual({
      kind: "failed",
      what: "transactions",
    });
    expect(bootState(input({ screen: "categories", categories: cats, transactions: tx }))).toEqual({
      kind: "failed",
      what: "categories",
    });
  });

  it("ignores a transactions failure on Categories", () => {
    const state = bootState(
      input({ screen: "categories", transactions: { loading: false, error: "boom" } })
    );
    expect(state).toEqual({ kind: "ready" });
  });

  it("says there is no connection when opened offline, before any data", () => {
    expect(bootState(input({ online: false, categories: { loading: true, error: null, count: 0 } }))).toEqual({
      kind: "offline",
    });
    // The first snapshot can arrive empty from the cache: still nothing has loaded.
    expect(bootState(input({ online: false, categories: { loading: false, error: null, count: 0 } }))).toEqual({
      kind: "offline",
    });
    // A failure caused by having no connection reads as no connection too.
    expect(
      bootState(input({ online: false, categories: { loading: false, error: "unavailable", count: 0 } }))
    ).toEqual({ kind: "offline" });
  });

  it("keeps the screen when the connection drops after the data arrived", () => {
    expect(bootState(input({ online: false }))).toEqual({ kind: "ready" });
  });

  it("puts setting up before everything else", () => {
    const state = bootState(
      input({ online: false, seeding: { done: 1, total: 16 }, categories: { loading: true, error: "x", count: 0 } })
    );
    expect(state.kind).toBe("setup");
  });
});
