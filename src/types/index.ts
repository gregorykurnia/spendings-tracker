export type Category = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  order: number;
};

export type Transaction = {
  id: string;
  amount: number;
  description: string;
  categoryId: string;
  date: string;
  type: "expense" | "income";
  source: "manual" | "ocr";
  status: "confirmed" | "pending_review";
  createdAt: string;
};
