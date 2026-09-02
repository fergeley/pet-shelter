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

/**
 * One FAQ row exactly as stored, for the admin editor.
 *
 * `FaqItem` above is the *public* projection: the repository resolves the
 * English text into any missing Malay field before handing it out, so every
 * reader gets a plain `string` and no page can render a blank Malay question.
 * The editor needs the unresolved values — otherwise saving a row that has no
 * translation would silently write the English copy into the Malay column and
 * freeze it there, so a later edit to the English would no longer show through.
 */
export interface FaqRecord {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  questionMs: string | null;
  answerMs: string | null;
  displayOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}
