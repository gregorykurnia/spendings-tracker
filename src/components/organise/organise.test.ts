import { describe, expect, it } from "vitest";
import type { Category } from "@/types";
import {
  categoryCountLine,
  deleteButtonLabel,
  deleteNote,
  deletedMessage,
  firstGrapheme,
  isEmoji,
  missingFields,
  movedMessage,
  notSavedMessage,
  problems,
  savedMessage,
  spendCountLine,
  startingDraft,
  SUGGESTED_EMOJI,
  summaryLine,
} from "./organise";

const cat = (id: string, name: string, color = "mint"): Category => ({ id, name, emoji: "🛒", color, order: 0 });
const categories = [cat("food", "Food & Drink"), cat("travel", "Travel", "#2F7FC4")];

describe("the words on the list", () => {
  it("counts spends, with dots, and says when there are none", () => {
    expect(spendCountLine(0)).toBe("No spends yet");
    expect(spendCountLine(1)).toBe("1 spend");
    expect(spendCountLine(23)).toBe("23 spends");
    expect(spendCountLine(1234)).toBe("1.234 spends");
    expect(categoryCountLine(16)).toBe("16 categories");
    expect(categoryCountLine(1)).toBe("1 category");
  });
});

describe("the form", () => {
  it("starts a new category with a tag, the least used colour and no name", () => {
    expect(startingDraft({ kind: "add" }, "lime")).toEqual({ name: "", emoji: "🏷️", color: "lime" });
  });

  it("starts a change from the category, reading an old hex colour as the nearest swatch", () => {
    expect(startingDraft({ kind: "change", category: categories[1] }, "lime")).toEqual({
      name: "Travel",
      emoji: "🛒",
      color: "sky",
    });
  });

  it("needs a name, refuses one already used (capitals ignored) and needs an emoji", () => {
    const draft = { name: "  ", emoji: "🏷️", color: "mint" as const };
    expect(problems(draft, categories)).toEqual({ name: "Add a name." });
    expect(problems({ ...draft, name: "food & drink" }, categories).name).toBe(
      "You already have a category called “food & drink”."
    );
    expect(problems({ ...draft, name: "Pets", emoji: "x" }, categories)).toEqual({ emoji: "Choose an emoji." });
    expect(problems({ ...draft, name: "Pets", emoji: "" }, categories)).toEqual({ emoji: "Choose an emoji." });
    expect(problems({ ...draft, name: "Pets" }, categories)).toEqual({});
  });

  it("lets a category keep its own name when it is changed", () => {
    const draft = { name: "Food & Drink", emoji: "🍽️", color: "apricot" as const };
    expect(problems(draft, categories, "food")).toEqual({});
  });

  it("says what is still needed", () => {
    expect(summaryLine([])).toBe("");
    expect(summaryLine(["name"])).toBe("Still needed: a name.");
    expect(summaryLine(["emoji"])).toBe("Still needed: an emoji.");
    expect(summaryLine(["name", "emoji"])).toBe("Still needed: a name and an emoji.");
    expect(notSavedMessage(["name"])).toBe("Not saved. Still needed: a name.");
    expect(missingFields({ emoji: "x" })).toEqual(["emoji"]);
  });

  it("says where a new category went and what a change did", () => {
    expect(savedMessage({ kind: "add" }, "Pets")).toBe("Added Pets at the end of the list.");
    expect(savedMessage({ kind: "change", category: categories[0] }, "Food")).toBe("Saved changes to Food.");
  });
});

describe("emoji", () => {
  it("offers 28 and tells an emoji from a letter", () => {
    expect(SUGGESTED_EMOJI).toHaveLength(28);
    expect(isEmoji("🛒")).toBe(true);
    expect(isEmoji("🇮🇩")).toBe(true);
    expect(isEmoji("a")).toBe(false);
    expect(isEmoji("")).toBe(false);
  });

  it("keeps the first character as a person sees it", () => {
    expect(firstGrapheme("")).toBe("");
    expect(firstGrapheme("  🙂😀")).toBe("🙂");
    expect(firstGrapheme("🇮🇩🇯🇵")).toBe("🇮🇩");
    expect(firstGrapheme("👨‍👩‍👧 family")).toBe("👨‍👩‍👧");
    expect(firstGrapheme("✈️x")).toBe("✈️");
  });
});

describe("deleting", () => {
  it("says who uses it and asks where they go", () => {
    expect(deleteNote(69, 1)).toBe("69 spends use it. 1 waiting line does too. Choose where they go first.");
    expect(deleteNote(1, 0)).toBe("1 spend uses it. Choose where it goes first.");
    expect(deleteNote(0, 1)).toBe("No spends use it, but 1 waiting line does. Choose where it goes first.");
    expect(deleteNote(0, 3)).toBe("No spends use it, but 3 waiting lines do. Choose where they go first.");
  });

  it("names the button for what it will do", () => {
    expect(deleteButtonLabel(70, false)).toBe("Choose a category");
    expect(deleteButtonLabel(70, true)).toBe("Move 70 and delete");
  });

  it("reports what was deleted and moved", () => {
    expect(deletedMessage("Food", 0)).toBe("Deleted Food.");
    expect(deletedMessage("Food", 70, "Groceries")).toBe("Deleted Food. 70 spends moved to Groceries.");
    expect(deletedMessage("Food", 1, "Groceries")).toBe("Deleted Food. 1 spend moved to Groceries.");
  });

  it("says where a moved category is now", () => {
    expect(movedMessage("Travel", 3, 16)).toBe("Travel is now 3 of 16.");
  });
});
