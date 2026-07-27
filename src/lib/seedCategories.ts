import { Category } from "@/types";

export const SEED_CATEGORIES: Omit<Category, "id">[] = [
  { name: "Food & Drink", emoji: "🍽️", color: "#f97316", order: 0 },
  { name: "Groceries", emoji: "🛒", color: "#84cc16", order: 1 },
  { name: "Transport", emoji: "🚗", color: "#3b82f6", order: 2 },
  { name: "Home & Utilities", emoji: "🏠", color: "#0ea5e9", order: 3 },
  { name: "Business", emoji: "💼", color: "#64748b", order: 4 },
  { name: "Health", emoji: "💊", color: "#ef4444", order: 5 },
  { name: "Shopping", emoji: "👗", color: "#ec4899", order: 6 },
  { name: "Entertainment", emoji: "🎮", color: "#a855f7", order: 7 },
  { name: "Church & Giving", emoji: "⛪", color: "#eab308", order: 8 },
  { name: "Investments", emoji: "📈", color: "#22c55e", order: 9 },
  { name: "Education", emoji: "🎓", color: "#6366f1", order: 10 },
  { name: "Travel", emoji: "✈️", color: "#06b6d4", order: 11 },
  { name: "Relationship", emoji: "💑", color: "#f43f5e", order: 12 },
  { name: "Subscriptions", emoji: "🔧", color: "#78716c", order: 13 },
  { name: "Other", emoji: "❓", color: "#9ca3af", order: 14 },
];
