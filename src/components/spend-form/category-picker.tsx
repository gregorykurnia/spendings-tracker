"use client";

import { Icon } from "@/components/ui/icon";
import { CategoryDisc } from "@/components/ui/pill";
import { Sheet, SheetBody, SheetHead } from "@/components/ui/sheet";
import { cx } from "@/components/ui/cx";
import type { Category } from "@/types";
import styles from "./category-picker.module.css";

type Props = {
  /** Every category, in the owner's order. */
  categories: readonly Category[];
  /** The category chosen now, if any. */
  selectedId: string;
  /** A category was tapped. The picker closes itself after this returns. */
  onChoose: (categoryId: string) => void;
  onClose: () => void;
};

/** All the categories in one list, for when the quick choices don't have the one wanted. */
export function CategoryPicker({ categories, selectedId, onChoose, onClose }: Props) {
  return (
    <Sheet label="Choose a category" onClose={onClose}>
      <SheetHead title="Choose a category" />
      <SheetBody>
        <ul className={styles.list}>
          {categories.map((category) => {
            const on = category.id === selectedId;
            return (
              <li key={category.id}>
                <button
                  type="button"
                  className={cx(styles.row, on && styles.on)}
                  aria-pressed={on}
                  data-autofocus={on ? "" : undefined}
                  onClick={() => {
                    onChoose(category.id);
                    onClose();
                  }}
                >
                  <CategoryDisc emoji={category.emoji} color={category.color} />
                  <span>{category.name}</span>
                  {on ? <Icon name="check" /> : <span />}
                </button>
              </li>
            );
          })}
        </ul>
      </SheetBody>
    </Sheet>
  );
}
