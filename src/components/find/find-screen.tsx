"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SubBar } from "@/components/app/app-bar";
import { ScreenSkeleton } from "@/components/app/screen-skeletons";
import { SpendForm } from "@/components/spend-form/spend-form";
import type { SpendFormMode } from "@/components/spend-form/rules";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyCard } from "@/components/ui/empty-card";
import { SearchField, SelectField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useCategories } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import { todayISO } from "@/lib/dates";
import {
  activeFilters,
  applyFilters,
  clearSearchAndFilters,
  noResultsLine,
  removeFilter,
  searchWords,
  SORT_ORDERS,
  type ActiveFilter,
  type FindFilters,
  type SortOrder,
} from "@/lib/filters";
import { countLabel, formatRupiah } from "@/lib/money";
import { NO_CATEGORY_ID } from "@/lib/periods";
import type { Transaction } from "@/types";
import { FiltersSheet } from "./filters-sheet";
import { filtersFromParams, firstUseGo, NO_CATEGORY_CHOICE, PAGE_SIZE, paramsKey, readParams } from "./find";
import styles from "./find.module.css";
import { SpendRow } from "./spend-row";

type FormTarget = { kind: "add" } | { kind: "change"; spend: Transaction };

type View = { key: string; filters: FindFilters; limit: number };

const mainInput = () => document.querySelector<HTMLInputElement>("#main input[type=search]");
const filtersButton = () => document.querySelector<HTMLElement>("#main [data-find=filters]");

/**
 * All transactions: every saved spend, found by search, filters and order, with a row that opens
 * the Change spend form (which also deletes). Arriving from Spending starts with a category and a
 * period already on; arriving from a menu starts clean.
 */
export function FindScreen() {
  const { spends, waiting, loading, ...tx } = useTransactions();
  const { categories, loading: loadingCategories } = useCategories();
  const { announce } = useToast();
  const searchParams = useSearchParams();

  // Read on the client only (this part never renders on the server: the gate shows the skeleton).
  const today = todayISO();
  const key = paramsKey(readParams((name) => searchParams.get(name)));
  const [view, setView] = useState<View>(() => ({
    key,
    filters: filtersFromParams(readParams((name) => searchParams.get(name)), today),
    limit: PAGE_SIZE,
  }));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<FormTarget | null>(null);

  // A different arrival (Spending's link, or a menu link) starts over.
  if (view.key !== key) {
    setView({ key, filters: filtersFromParams(readParams((name) => searchParams.get(name)), today), limit: PAGE_SIZE });
  }
  const { filters, limit } = view;

  const wantsSearch = searchParams.get("focus") === "search";
  useEffect(() => {
    if (wantsSearch) mainInput()?.focus();
  }, [wantsSearch, loading, loadingCategories]);

  const categoryIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);
  const results = useMemo(() => applyFilters(spends, filters, categoryIds), [spends, filters, categoryIds]);

  if (loading || loadingCategories) return <ScreenSkeleton screen="transactions" />;

  const categoryName = (id: string) =>
    id === NO_CATEGORY_ID ? NO_CATEGORY_CHOICE.name : (categories.find((c) => c.id === id)?.name ?? NO_CATEGORY_CHOICE.name);
  const active = activeFilters(filters, today, categoryName);
  const words = searchWords(filters.query);
  const total = results.reduce((sum, t) => sum + (t.amount ?? 0), 0);

  function change(next: FindFilters) {
    setView((v) => ({ ...v, filters: next, limit: PAGE_SIZE }));
  }

  function removeOne(chip: ActiveFilter) {
    const next = removeFilter(filters, chip.key);
    change(next);
    announce(`Filter removed. ${countLabel(applyFilters(spends, next, categoryIds).length, "spend")}.`);
    filtersButton()?.focus();
  }

  function clearFilters() {
    const next = { ...clearSearchAndFilters(filters, today), query: filters.query };
    change(next);
    announce("Filters cleared.");
  }

  function clearAll() {
    change(clearSearchAndFilters(filters, today));
    announce("Search and filters cleared.");
    mainInput()?.focus();
  }

  const firstUse = spends.length === 0;
  const back = searchParams.get("back") === "spending" ? { href: "/spending", label: "Spending" } : {};

  // The form edits the live spend; once it is deleted from the form the data drops it, and the form
  // goes on showing the spend it opened with until it closes itself.
  const mode: SpendFormMode | null =
    form === null
      ? null
      : form.kind === "add"
        ? { kind: "add" }
        : { kind: "change", spend: spends.find((s) => s.id === form.spend.id) ?? form.spend };

  const asked = noResultsLine(filters, active.length);

  return (
    <>
      <SubBar {...back} onTypeInSpend={() => setForm({ kind: "add" })} />
      <main id="main" tabIndex={-1} className={styles.fx}>
        <h1>All transactions</h1>
        {firstUse ? (
          <EmptyCard
            icon="list"
            title="No spends yet."
            className={styles.empty}
            actions={
              <ButtonLink variant="solid" href="/">
                {firstUseGo(waiting.length)}
              </ButtonLink>
            }
          >
            <p>Accepted and typed-in spends show up here, ready to search.</p>
          </EmptyCard>
        ) : (
          <>
            <SearchField
              className={styles.search}
              label="Search store or note"
              placeholder="Search store or note"
              value={filters.query}
              onChange={(event) => change({ ...filters, query: event.target.value })}
              onClear={() => {
                change({ ...filters, query: "" });
                mainInput()?.focus();
              }}
            />
            <div className={styles.ctl}>
              <Button data-find="filters" aria-haspopup="dialog" className={styles.fbtn} onClick={() => setSheetOpen(true)}>
                <Icon name="sliders" />
                Filters
                {active.length ? (
                  <span className={styles.badge}>
                    {active.length}
                    <span className="sr-only"> on</span>
                  </span>
                ) : null}
              </Button>
              <SelectField
                label="Order"
                value={filters.sort}
                onChange={(event) => change({ ...filters, sort: event.target.value as SortOrder })}
              >
                {SORT_ORDERS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
            </div>

            {active.length ? (
              <div className={styles.chips} role="group" aria-label="Filters on">
                {active.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className={styles.chip}
                    aria-label={`Remove filter: ${chip.label}`}
                    onClick={() => removeOne(chip)}
                  >
                    {chip.label}
                    <Icon name="close" size={18} />
                  </button>
                ))}
                <Button
                  variant="quiet"
                  onClick={() => {
                    clearFilters();
                    // The chips go, this button with them: focus moves to Filters.
                    filtersButton()?.focus();
                  }}
                >
                  Clear all
                </Button>
              </div>
            ) : null}

            <p className={styles.count} aria-live="polite">
              {countLabel(results.length, "spend")}
              {results.length ? ` · ${formatRupiah(total)}` : ""}
            </p>

            {results.length === 0 ? (
              <EmptyCard
                icon="search"
                title="No spends match."
                className={styles.empty}
                actions={
                  <Button variant="solid" onClick={clearAll}>
                    Clear search and filters
                  </Button>
                }
              >
                {asked ? <p>{asked}</p> : null}
              </EmptyCard>
            ) : (
              <>
                <ul className={styles.list}>
                  {results.slice(0, limit).map((spend) => (
                    <SpendRow
                      key={spend.id}
                      spend={spend}
                      categories={categories}
                      today={today}
                      words={words}
                      onOpen={(s) => setForm({ kind: "change", spend: s })}
                    />
                  ))}
                </ul>
                {results.length > limit ? (
                  <Button
                    variant="quiet"
                    className={styles.more}
                    onClick={() => setView((v) => ({ ...v, limit: v.limit + PAGE_SIZE }))}
                  >
                    {`Show ${Math.min(PAGE_SIZE, results.length - limit)} more`}
                  </Button>
                ) : null}
              </>
            )}
          </>
        )}
      </main>
      {sheetOpen ? (
        <FiltersSheet
          filters={filters}
          categories={categories}
          spends={spends}
          today={today}
          matches={results.length}
          categoryName={categoryName}
          onChange={change}
          onClear={clearFilters}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
      {mode ? <SpendForm mode={mode} categories={categories} actions={tx} onClose={() => setForm(null)} /> : null}
    </>
  );
}
