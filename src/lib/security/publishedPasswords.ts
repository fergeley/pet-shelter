/**
 * Every password this repository has published for a staff account.
 *
 * The repository is public, so none of these is a secret: they are in the seed, on the
 * login page, and in git history for good. Production was seeded with them on
 * 2026-08-15. A published password proves nothing about who is typing it, so it is
 * refused as a credential in production (`loginAction`) and refused everywhere as a
 * password someone sets (`registerAction`, `acceptInvitationSchema`).
 *
 * **Append-only.** Removing a seed account does not unpublish its password, and the
 * rows it wrote stay in whichever databases were seeded with it. That is why `vol123`
 * is here: the seed dropped `volunteer@hopeforstrays.org` on 2026-09-02, after the
 * production seed ran. Add any password a seed publishes in future; the test in
 * `tests/unit/security/publishedStaffPasswords.test.ts` fails if a seed publishes one
 * this list does not name.
 *
 * **One copy lives outside this file:** the password-hash command in
 * `docs/runbooks/RUNBOOK_PRODUCTION_STAFF_ACCOUNT_LOCKDOWN.md` refuses the same passwords, and
 * has to work in a checkout that predates this module. The same test fails if the two differ.
 *
 * Refusing the password rather than the seeded account ids is deliberate — see
 * `tasks/decisions/2026-09-16-a-published-password-is-refused-not-the-account.md`.
 */
export const PUBLISHED_STAFF_PASSWORDS: ReadonlySet<string> = new Set([
  "admin123",
  "coord123",
  "animal123",
  "content123",
  "staff123",
  "vol123",
]);

export const PUBLISHED_PASSWORD_MESSAGE =
  "This password is published in this project's public source code, so it cannot protect an account. Choose a different one.";

export function isPublishedStaffPassword(password: string): boolean {
  return PUBLISHED_STAFF_PASSWORDS.has(password);
}
