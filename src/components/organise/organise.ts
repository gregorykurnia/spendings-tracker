// What the Categories screen decides, apart from drawing it: the words, what a category form still
// needs, the delete question's wording. Pure, so unit tests cover it (design notes §5, decisions O2 to O6).

import { formatDigits } from "@/lib/money";
import { swatchFor, type SwatchName } from "@/lib/swatches";
import type { Category } from "@/types";

/** The 28 emoji offered to tap; any other can be typed or pasted. */
export const SUGGESTED_EMOJI = [
  "🛒", "🍽️", "☕", "🍔", "🚗", "🚌", "⛽", "✈️", "🏠", "💡", "📶", "📱", "💻", "👗",
  "👟", "💊", "🏥", "🎓", "📚", "🎮", "🎬", "🎁", "💑", "👶", "🐶", "⛪", "💼", "📈",
] as const;

/** A new category starts with this one. */
export const NEW_CATEGORY_EMOJI = "🏷️";

/** The first four categories are the quick choices when a spend is checked. */
export const QUICK_CHOICES = 4;

const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

export function isEmoji(text: string) {
  return EMOJI.test(text);
}

/** The first character as a person sees it (a flag or a family is one), so a pasted word keeps one. */
export function firstGrapheme(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const first = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(trimmed)[Symbol.iterator]().next();
    return first.done ? "" : first.value.segment;
  }
  return Array.from(trimmed)[0];
}

export function plural(n: number, one: string, many: string) {
  return `${formatDigits(n)} ${n === 1 ? one : many}`;
}

/** Under a category's name on the list. */
export function spendCountLine(spends: number) {
  return spends ? plural(spends, "spend", "spends") : "No spends yet";
}

export function categoryCountLine(n: number) {
  return plural(n, "category", "categories");
}

/* ---------- the form ---------- */

export type CategoryDraft = { name: string; emoji: string; color: SwatchName };
export type CategoryField = "name" | "emoji";
export type CategoryProblems = Partial<Record<CategoryField, string>>;

export type CategoryFormMode = { kind: "add" } | { kind: "change"; category: Category };

export function startingDraft(mode: CategoryFormMode, leastUsed: SwatchName): CategoryDraft {
  if (mode.kind === "change") {
    const { name, emoji, color } = mode.category;
    return { name, emoji, color: swatchFor(color) };
  }
  return { name: "", emoji: NEW_CATEGORY_EMOJI, color: leastUsed };
}

/** What is wrong with the draft, in the words the form shows under the field. */
export function problems(
  draft: CategoryDraft,
  categories: readonly Category[],
  changingId?: string
): CategoryProblems {
  const found: CategoryProblems = {};
  const name = draft.name.trim();
  if (!name) found.name = "Add a name.";
  else if (categories.some((c) => c.id !== changingId && c.name.trim().toLowerCase() === name.toLowerCase())) {
    found.name = `You already have a category called “${name}”.`;
  }
  if (!draft.emoji || !isEmoji(draft.emoji)) found.emoji = "Choose an emoji.";
  return found;
}

export function missingFields(found: CategoryProblems): CategoryField[] {
  return (["name", "emoji"] as const).filter((key) => found[key]);
}

/** "Still needed: a name and an emoji." */
export function summaryLine(keys: readonly CategoryField[]) {
  if (!keys.length) return "";
  if (keys.length === 2) return "Still needed: a name and an emoji.";
  return `Still needed: ${keys[0] === "name" ? "a name" : "an emoji"}.`;
}

export function notSavedMessage(keys: readonly CategoryField[]) {
  return `Not saved. ${summaryLine(keys)}`;
}

export function savedMessage(mode: CategoryFormMode, name: string) {
  return mode.kind === "add" ? `Added ${name} at the end of the list.` : `Saved changes to ${name}.`;
}

/* ---------- delete ---------- */

/** What the check found: nothing uses it, or something does and must move first. */
export function usedBy(spends: number, waiting: number) {
  return spends + waiting;
}

export function deleteNote(spends: number, waiting: number) {
  const lead = spends
    ? `${plural(spends, "spend uses", "spends use")} it.${waiting ? ` ${plural(waiting, "waiting line does", "waiting lines do")} too.` : ""}`
    : `No spends use it, but ${plural(waiting, "waiting line does", "waiting lines do")}.`;
  return `${lead} Choose where ${usedBy(spends, waiting) === 1 ? "it goes" : "they go"} first.`;
}

export function deleteButtonLabel(moving: number, chosen: boolean) {
  return chosen ? `Move ${formatDigits(moving)} and delete` : "Choose a category";
}

export function deletedMessage(name: string, moved: number, destination?: string) {
  return moved && destination
    ? `Deleted ${name}. ${plural(moved, "spend", "spends")} moved to ${destination}.`
    : `Deleted ${name}.`;
}

/** Said when the order changes: where the category is now. */
export function movedMessage(name: string, place: number, of: number) {
  return `${name} is now ${place} of ${of}.`;
}
