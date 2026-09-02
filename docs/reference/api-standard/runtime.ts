/**
 * The seam. Everything in this file is a stub you replace with the real data access and
 * auth layer; it exists so the reference handlers compile and read as working code
 * rather than pseudocode.
 */

import { problem } from "./problem";
import type { SortTerm } from "./collection";

export const PRODUCT_STATUSES = ["active", "draft", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export interface Product {
  /** Opaque, prefixed, sortable. Standard rule N2. */
  id: string;
  name: string;
  category_id: string;
  brand_id: string;
  status: ProductStatus;
  price: number;
  /** Monotonic per-row version, used as the ETag source. */
  version: number;
  updated_at: string;
}

export interface ListProductsArgs {
  tenantId: string;
  category?: string;
  brand?: string;
  status?: ProductStatus[];
  price_gte?: number;
  price_lte?: number;
  q?: string;
  sort: SortTerm[];
  /** Keyset anchor: the sort values and id of the last row of the previous page. */
  after?: { keys: (string | number | null)[]; id: string };
  /** Always requested as `limit + 1` so `has_more` needs no COUNT. */
  take: number;
}

export interface ProductRepository {
  list(args: ListProductsArgs): Promise<Product[]>;
  /** MUST filter by tenantId in the query itself, never in application code afterwards. */
  find(tenantId: string, productId: string): Promise<Product | null>;
  create(tenantId: string, input: unknown): Promise<Product>;
  update(tenantId: string, productId: string, patch: unknown): Promise<Product>;
}

export interface Principal {
  tenantId: string;
  scopes: readonly string[];
}

export function getProductRepository(): ProductRepository {
  throw new Error("Replace with the real repository implementation.");
}

/**
 * Resolves the caller from the credential.
 *
 * Note what this returns and what the URL does not contain: the tenant. Standard rule
 * N7 — tenancy lives in the token, never in the path, so there is no address a customer
 * can edit to reach another customer's data.
 */
// The real implementation reads the Authorization header off this request; the stub
// throws before it gets that far.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function authenticate(_request: Request): Promise<Principal | null> {
  throw new Error("Replace with the real credential verification.");
}

/** Extracts the sort key values from a row, in the order the sort spec requires. */
export function sortKeyValues(row: Product, sort: SortTerm[]): (string | number | null)[] {
  return sort.map((term) => {
    const value = (row as unknown as Record<string, unknown>)[term.field];
    return typeof value === "string" || typeof value === "number" ? value : null;
  });
}

export function unauthenticated(instance?: string): Response {
  return problem("unauthenticated", {
    detail: "Provide a bearer token with the required scope.",
    instance,
    headers: { "WWW-Authenticate": 'Bearer realm="api"' },
  });
}

export function forbidden(scope: string, instance?: string): Response {
  return problem("forbidden", {
    detail: `This credential is missing the '${scope}' scope.`,
    instance,
  });
}
