"use client";

import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Chip, Chips } from "@/components/ui/chip";
import { AmountField, DateField, FieldError } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetBody, SheetButtons, SheetFoot, SheetHead } from "@/components/ui/sheet";
import { StepButton } from "@/components/ui/step-button";
import {
  activeFilters,
  dateFilterLabel,
  dateFilterRange,
  stepDateFilter,
  type DateFilterKind,
  type FindFilters,
} from "@/lib/filters";
import { formatDigits } from "@/lib/money";
import styles from "./find.module.css";
import { categoryChoices, parseAmountFilter, rangeProblem, showLabel, switchDateKind } from "./find";
import type { Category } from "@/types";

const KINDS: { kind: DateFilterKind; label: string }[] = [
  { kind: "all", label: "All time" },
  { kind: "day", label: "A day" },
  { kind: "week", label: "A week" },
  { kind: "month", label: "A month" },
  { kind: "custom", label: "Custom" },
];

/** One part of the sheet: a heading and its controls. `group` names the controls as a group (when they aren't chips, which name themselves). */
function Part({ title, group, children }: { title: string; group?: boolean; children: ReactNode }) {
  const id = useId();
  return (
    <div className={styles.fs} role={group ? "group" : undefined} aria-labelledby={group ? id : undefined}>
      <h3 id={id}>{title}</h3>
      {children}
    </div>
  );
}

type Props = {
  filters: FindFilters;
  categories: readonly Category[];
  /** Every saved spend, to know whether "No category" is a choice. */
  spends: readonly { categoryId: string }[];
  today: string;
  /** How many spends the search and these filters show: the main button says so. */
  matches: number;
  /** The name of a category, `No category` for one that was removed (for the filters that are on). */
  categoryName: (id: string) => string;
  onChange: (next: FindFilters) => void;
  onClear: () => void;
  onClose: () => void;
};

/** The filters, in a sheet (a dialog from 700 wide). Changes apply as you go (F2, F3). */
export function FiltersSheet({
  filters,
  categories,
  spends,
  today,
  matches,
  categoryName,
  onChange,
  onClear,
  onClose,
}: Props) {
  const date = filters.date;
  const range = dateFilterRange(date);
  const on = activeFilters(filters, today, categoryName).length > 0;
  const problem = rangeProblem(filters);
  const stepped = date.kind === "day" || date.kind === "week" || date.kind === "month";
  const atNow = Boolean(range && range.to >= today);

  const setDate = (patch: Partial<FindFilters["date"]>) => onChange({ ...filters, date: { ...date, ...patch } });
  const toggleCategory = (id: string) =>
    onChange({
      ...filters,
      categoryIds: filters.categoryIds.includes(id)
        ? filters.categoryIds.filter((c) => c !== id)
        : [...filters.categoryIds, id],
    });

  return (
    <Sheet label="Filters" onClose={onClose} className={styles.filters}>
      <SheetHead title="Filters" />
      <SheetBody>
        <Part title="Dates">
          <Chips label="Dates">
            {KINDS.map(({ kind, label }) => (
              <Chip
                key={kind}
                on={date.kind === kind}
                onClick={() => onChange({ ...filters, date: switchDateKind(date, kind, range) })}
              >
                {label}
              </Chip>
            ))}
          </Chips>
          {stepped ? (
            <>
              <div className={styles.dstep}>
                <StepButton
                  direction="left"
                  label={`Earlier ${date.kind}`}
                  onPress={() => setDate({ anchor: stepDateFilter(date, -1) })}
                />
                <p className={styles.dstepLabel}>{dateFilterLabel(date, today)}</p>
                <StepButton
                  direction="right"
                  label={`Later ${date.kind}`}
                  disabled={atNow}
                  onPress={() => setDate({ anchor: stepDateFilter(date, 1) })}
                />
              </div>
              <DateField
                label="Jump to a date"
                value={date.anchor}
                onChange={(value) => value && setDate({ anchor: value })}
              />
            </>
          ) : null}
          {date.kind === "custom" ? (
            <>
              <div className={styles.two}>
                <DateField
                  label="From"
                  placeholder="Not set"
                  value={date.from}
                  onChange={(value) => setDate({ from: value, label: "" })}
                />
                <DateField
                  label="To"
                  placeholder="Not set"
                  value={date.to}
                  onChange={(value) => setDate({ to: value, label: "" })}
                />
              </div>
              {problem.dates ? <FieldError>{problem.dates}</FieldError> : null}
            </>
          ) : null}
        </Part>

        <Part title="Categories">
          <Chips label="Categories">
            {categoryChoices(categories, spends, filters.categoryIds).map((c) => (
              <Chip key={c.id} emoji={c.emoji} on={filters.categoryIds.includes(c.id)} onClick={() => toggleCategory(c.id)}>
                {c.name}
              </Chip>
            ))}
          </Chips>
        </Part>

        <Part title="Amount" group>
          <div className={styles.two}>
            <AmountField
              label="At least"
              placeholder="Any"
              value={filters.min == null ? "" : formatDigits(filters.min)}
              onChange={(event) => onChange({ ...filters, min: parseAmountFilter(event.target.value) })}
            />
            <AmountField
              label="At most"
              placeholder="Any"
              value={filters.max == null ? "" : formatDigits(filters.max)}
              onChange={(event) => onChange({ ...filters, max: parseAmountFilter(event.target.value) })}
            />
          </div>
          {problem.amount ? <FieldError>{problem.amount}</FieldError> : null}
        </Part>

        <Part title="Source">
          <Chips label="Source">
            {(
              [
                ["any", "Any", null],
                ["ocr", "Screenshot", "image"],
                ["manual", "Typed in", "pencil"],
              ] as const
            ).map(([value, label, icon]) => (
              <Chip
                key={value}
                on={filters.source === value}
                onClick={() => onChange({ ...filters, source: value })}
              >
                {icon ? <Icon name={icon} size={18} /> : null}
                {label}
              </Chip>
            ))}
          </Chips>
        </Part>
      </SheetBody>
      <SheetFoot>
        <SheetButtons>
          <Button size="big" variant="quiet" disabled={!on} onClick={onClear}>
            Clear all
          </Button>
          <Button size="big" variant="solid" disabled={matches === 0} onClick={onClose}>
            {showLabel(matches)}
          </Button>
        </SheetButtons>
      </SheetFoot>
    </Sheet>
  );
}
