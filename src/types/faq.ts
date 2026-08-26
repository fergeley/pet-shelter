export type FaqCategory =
  | "tnrm"
  | "sponsorship"
  | "adoption"
  | "visiting"
  | "get_involved"
  | "general"
  | "medical";

export interface FaqItem {
  id: string;
  category: FaqCategory;
  categoryLabel: string;
  categoryLabelMs: string;
  question: string;
  questionMs: string;
  answer: string;
  answerMs: string;
}

export interface FaqFilterState {
  category?: string;
  search?: string;
}

export type FaqFilterInput = FaqFilterState;
