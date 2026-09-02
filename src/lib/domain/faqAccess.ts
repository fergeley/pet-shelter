import { ROLES, type Role } from "@/lib/security/rbac";

/**
 * Roles permitted to manage the FAQ knowledge base.
 *
 * The task brief names `SUPER_ADMIN` and `CONTENT_EDITOR`, which do not exist
 * in this codebase's `Role` enum. They map onto the two roles that already
 * carry those responsibilities: ADMIN owns the platform, COORDINATOR edits
 * public-facing content.
 *
 * This lives in its own module because both `src/actions/faqs.ts` and
 * `src/app/admin/faqs/page.tsx` need it, and a `"use server"` module may only
 * export async functions — so the actions file cannot be the shared home for a
 * constant. Two hand-maintained copies would let the page and the actions
 * disagree, which fails in the worst direction: the page renders an editor that
 * every action then rejects, or hides one the actions would have allowed.
 */
export const FAQ_EDITOR_ROLES: readonly Role[] = [ROLES.ADMIN, ROLES.COORDINATOR];
