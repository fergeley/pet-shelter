import { test as base, type Page } from "@playwright/test";
import { sealSession, SESSION_COOKIE_NAME, type SessionUser } from "@/lib/security/session";

/**
 * A browser context already carrying a valid staff session.
 *
 * Driving `/admin/login` before every admin spec would spend a scrypt
 * verification and two navigations per test to re-prove something Tier 3
 * already covers, and it makes every admin journey fail whenever the login form
 * changes. Sealing the cookie directly is the same credential the server issues
 * — `sealSession` is the production function, not a stand-in — so the session is
 * genuine, merely obtained without the form.
 */

/** Storage key `useAdminAuth` caches the signed-in user under. */
const ADMIN_STORAGE_KEY = "hope_for_strays_admin_session";

export const ADMIN_USER: Omit<SessionUser, "expiresAt"> = {
  id: "usr-admin-01",
  email: "admin@hopeforstrays.org",
  name: "Dr. Sarah Tan",
  role: "ADMIN",
};

export const COORDINATOR_USER: Omit<SessionUser, "expiresAt"> = {
  id: "usr-coord-01",
  email: "coordinator@hopeforstrays.org",
  name: "Priya Devi",
  role: "COORDINATOR",
};

/**
 * Signs `page` in as `user`, seeding both halves of the session.
 *
 * The cookie is what the server reads. `localStorage` matters too: the admin
 * layout gate is a client component whose `useAdminAuth` hook renders a loading
 * screen, then redirects to `/admin/login` if it resolves before the session
 * round-trip returns. Seeding its cache as well removes that race, so an admin
 * spec never flakes on the redirect firing first.
 */
export async function signIn(page: Page, user = ADMIN_USER): Promise<void> {
  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: sealSession(user),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.addInitScript(
    ([key, payload]) => {
      try {
        window.localStorage.setItem(key, payload);
      } catch {
        // Private-mode storage; the cookie alone still authenticates.
      }
    },
    [ADMIN_STORAGE_KEY, JSON.stringify({ ...user, expiresAt: Date.now() + 86_400_000 })] as const
  );
}

/**
 * `test` extended with an `adminPage` already signed in as an ADMIN.
 *
 * Specs that need the public, signed-out experience keep using the plain `page`
 * fixture from `@playwright/test`.
 */
export const test = base.extend<{ adminPage: Page }>({
  // The second parameter is Playwright's `use`, renamed because it is passed
  // positionally and `react-hooks/rules-of-hooks` otherwise reads the call as a
  // misplaced React `use()` hook and fails the lint job.
  adminPage: async ({ page }, provide) => {
    await signIn(page, ADMIN_USER);
    await provide(page);
  },
});

export { expect } from "@playwright/test";
