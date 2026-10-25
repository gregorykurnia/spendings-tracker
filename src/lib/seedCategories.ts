import { Category } from "@/types";

export const TELECOMMUNICATIONS_CATEGORY = {
  name: "Telecommunications",
  emoji: "📶",
  color: "indigo",
};

// The starter order is the owner's; colours are the design's swatch names.
export const SEED_CATEGORIES: Omit<Category, "id">[] = [
  { name: "Food & Drink", emoji: "🍽️", color: "apricot", order: 0 },
  { name: "Groceries", emoji: "🛒", color: "mint", order: 1 },
  { name: "Transport", emoji: "🚗", color: "sky", order: 2 },
  { name: "Home & Utilities", emoji: "🏠", color: "lilac", order: 3 },
  { name: "Business", emoji: "💼", color: "indigo", order: 4 },
  { name: "Health", emoji: "💊", color: "coral", order: 5 },
  { name: "Shopping", emoji: "👗", color: "rose", order: 6 },
  { name: "Entertainment", emoji: "🎮", color: "plum", order: 7 },
  { name: "Church & Giving", emoji: "⛪", color: "sand", order: 8 },
  { name: "Investments", emoji: "📈", color: "slate", order: 9 },
  { name: "Education", emoji: "🎓", color: "lime", order: 10 },
  { name: "Travel", emoji: "✈️", color: "cyan", order: 11 },
  { name: "Relationship", emoji: "💑", color: "rose", order: 12 },
  { name: "Subscriptions", emoji: "🔧", color: "aqua", order: 13 },
  { ...TELECOMMUNICATIONS_CATEGORY, order: 14 },
  { name: "Other", emoji: "❓", color: "slate", order: 15 },
];

/** The document ID of a starter category, so seeding can be finished after a failure without doubles. */
export function starterCategoryId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
