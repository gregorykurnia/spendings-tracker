// Whole-app states: what the app shows in place of a screen while it can't show the screen yet.
// Pure, so the rules are tested without a browser. `AppGate` feeds it from the data hooks.

export type ScreenName = "home" | "spending" | "transactions" | "categories";

/** The screen a path belongs to, or `null` for anything else (those aren't gated). */
export function screenFor(pathname: string | null | undefined): ScreenName | null {
  if (pathname == null) return null;
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  if (path === "/spending") return "spending";
  if (path === "/transactions") return "transactions";
  if (path === "/categories") return "categories";
  return null;
}

/** What failed to load, for "Couldn't load your …". */
export type LoadTarget = "transactions" | "categories";

export type BootState =
  | { kind: "ready" }
  | { kind: "setup"; done: number; total: number }
  | { kind: "loading" }
  | { kind: "failed"; what: LoadTarget }
  | { kind: "offline" };

export type BootInput = {
  screen: ScreenName;
  online: boolean;
  categories: { loading: boolean; error: string | null; count: number };
  /** Progress of the first-open seeding of the starter categories, while it runs. */
  seeding: { done: number; total: number } | null;
  transactions: { loading: boolean; error: string | null };
};

/**
 * Which whole-app state applies, in this order:
 * 1. setting up the starter categories (the very first open);
 * 2. no connection before any data has arrived: nothing can load, so say so (no categories at all
 *    means nothing has arrived, since a set-up app always has some);
 * 3. something failed to load;
 * 4. still loading;
 * 5. ready: the screen shows.
 * Categories is the one screen that doesn't wait for transactions.
 */
export function bootState(input: BootInput): BootState {
  const { screen, online, categories, seeding, transactions } = input;
  const needsTransactions = screen !== "categories";

  if (seeding) return { kind: "setup", done: seeding.done, total: seeding.total };

  const loading = categories.loading || (needsTransactions && transactions.loading);
  if (!online && (loading || categories.count === 0)) return { kind: "offline" };

  const transactionsFailed = needsTransactions && transactions.error !== null;
  if (categories.error !== null || transactionsFailed) {
    // Name the thing this screen is about first: Categories is about categories, the others about spends.
    const what: LoadTarget =
      screen === "categories" || !transactionsFailed ? "categories" : "transactions";
    return { kind: "failed", what };
  }

  if (loading) return { kind: "loading" };
  return { kind: "ready" };
}
