// What All transactions shows, worked out from the address and the choices made on the screen.
// Pure, so the rules are tested without a browser; the search and filter logic is in `src/lib/filters.ts`.

import {
  blankFilters,
  type DateFilterKind,
  type FindFilters,
  type FindSpend,
} from "@/lib/filters";
import { isISODate } from "@/lib/dates";
import { countLabel } from "@/lib/money";
import { NO_CATEGORY_ID } from "@/lib/periods";
import type { Category } from "@/types";

/** How many spends show before "Show N more". */
export const PAGE_SIZE = 60;

/** What a spend whose category was removed is called, and drawn as (also a filter choice). */
export const NO_CATEGORY_CHOICE = { id: NO_CATEGORY_ID, name: "No category", emoji: "❔" } as const;

/** The parts of the address that set the filters: Spending sends these (`categoryHref`). */
export type FindParams = {
  cat: string;
  from: string;
  to: string;
  label: string;
  q: string;
};

export function readParams(get: (name: string) => string | null): FindParams {
  return {
    cat: get("cat") ?? "",
    from: get("from") ?? "",
    to: get("to") ?? "",
    label: get("label") ?? "",
    q: get("q") ?? "",
  };
}

/**
 * Which arrival this is. Opening the page from Spending (a category in a period) starts with those
 * filters; opening it from a menu starts clean. A new key starts over.
 */
export function paramsKey(p: FindParams) {
  return JSON.stringify([p.cat, p.from, p.to, p.label, p.q]);
}

/** The filters an arrival starts with. A date that isn't one is ignored rather than trusted. */
export function filtersFromParams(p: FindParams, today: string): FindFilters {
  const f = blankFilters(today);
  if (p.cat) f.categoryIds = [p.cat];
  const from = isISODate(p.from) ? p.from : "";
  const to = isISODate(p.to) ? p.to : "";
  if (from || to) f.date = { kind: "custom", anchor: today, from, to, label: p.label };
  if (p.q) f.query = p.q;
  return f;
}

/** The categories to choose from in the filters: the owner's order, then "No category" when it applies. */
export function categoryChoices(
  categories: readonly Category[],
  spends: readonly Pick<FindSpend, "categoryId">[],
  selected: readonly string[]
) {
  const known = new Set(categories.map((c) => c.id));
  const choices: { id: string; name: string; emoji: string }[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
  }));
  const needed = selected.includes(NO_CATEGORY_ID) || spends.some((s) => !known.has(s.categoryId));
  if (needed) choices.push({ ...NO_CATEGORY_CHOICE });
  return choices;
}

/** The main button of the filters sheet: what you'll see. */
export function showLabel(n: number) {
  return n ? `Show ${countLabel(n, "spend")}` : "No spends match";
}

/** Changing the kind of date filter: a custom span starts from the days the old kind covered. */
export function switchDateKind(
  date: FindFilters["date"],
  kind: DateFilterKind,
  range: { from: string; to: string } | null
): FindFilters["date"] {
  if (kind === date.kind) return date;
  if (kind === "all") return { ...date, kind, from: "", to: "", label: "" };
  if (kind === "custom") return { ...date, kind, from: range?.from ?? "", to: range?.to ?? "", label: "" };
  return { ...date, kind };
}

/** The whole-rupiah number typed in an amount field, or `null` when it is empty. At most 12 digits. */
export function parseAmountFilter(text: string): number | null {
  const digits = text.replace(/\D/g, "").replace(/^0+/, "").slice(0, 12);
  return digits ? parseInt(digits, 10) : null;
}

/** The line under the date or amount fields when the two ends contradict each other. */
export function rangeProblem(f: FindFilters): { dates: string; amount: string } {
  const d = f.date;
  return {
    dates: d.kind === "custom" && d.from && d.to && d.from > d.to ? "The end is before the start." : "",
    amount: f.min != null && f.max != null && f.min > f.max ? "The most is below the least." : "",
  };
}

/** The link in the "No spends yet." card: the waiting lines come first when there are any. */
export function firstUseGo(waiting: number) {
  return waiting > 0 ? "Go and check them" : "Add screenshots";
}
