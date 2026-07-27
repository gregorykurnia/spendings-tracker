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
  store: string;
  description: string;
  categoryId: string;
  date: string;
  source: "manual" | "ocr";
  status: "confirmed" | "pending_review";
  createdAt: string;
};
