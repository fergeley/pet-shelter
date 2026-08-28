export type RehabNeedCategory =
  | "URGENT"
  | "REGULAR"
  | "LONG_TERM"
  | "TNRM_EQUIPMENT"
  | "MEDICAL"
  | "FACILITY"
  | "NUTRITION";

export type RehabUrgencyLevel = "Critical" | "High" | "Normal" | "Low";

export interface RehabNeed {
  id: string;
  category: RehabNeedCategory;
  name: string;
  nameMs: string;
  description: string;
  descriptionMs: string;
  quantityNeeded: string;
  urgencyLevel: RehabUrgencyLevel | string;
  estimatedCostMYR?: number;
  shopeeLink?: string;
  brand?: string;
}

export interface RehabFilterState {
  category?: string;
  search?: string;
}

export type RehabNeedFilterInput = RehabFilterState;
