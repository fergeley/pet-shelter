# A published password is refused, not the account that holds it

**Decided:** 2026-09-16

The repository is public. `prisma/seed.ts` and `src/lib/server/userStore.ts` give five staff
accounts compile-time passwords (`admin123` for SUPER_ADMIN among them), `/admin/login` pre-filled
the Super Admin's and offered one-click buttons for all five, and the Neon production branch was
seeded on 2026-08-15. With a database the seeded rows answered; without one `userStore`'s in-memory
copy of the seed did, and the DAL's outage path then trusted the cookie. The production guard in
`readFallbackAuthState` (2026-09-08) covered neither, because it runs after sign-in and only for a
reachable database with no row.

Observed before the fix, on a `next build` of `85ee351` served offline by `next start`
(`DATABASE_URL=""`): the page arrived pre-filled with `admin@hopeforstrays.org`, rendered the demo
block, and one press of "Sign In to Portal" set `hope_shelter_session`.

Observed after it, on the same kind of build of this change: nothing pre-filled, no demo block,
`admin123` typed by hand answered "Invalid staff email or password" with no cookie, and none of the
five passwords nor "Quick Demo" appears in the 21 script chunks `/admin/login` serves — the block is
compiled out, not hidden. Offline `next dev` e2e: 23 passed.

## What was chosen

1. `loginAction` refuses any password in `src/lib/security/publishedPasswords.ts` when
   `NODE_ENV === "production"`, **before** the account lookup, with the ordinary invalid-credentials
   message and its own audit reason.
2. `registerAction` and `acceptInvitationSchema` refuse the same passwords **in every environment**.
3. The login page pre-fills nothing, and renders the demo block only outside production.

## Why the password and not the seeded account ids

- **The ids in hand were incomplete.** Every seed from `e0884e9` (2026-08-15) until `fb61945`
  (2026-09-02) also wrote `volunteer@hopeforstrays.org` / `vol123` (`usr-vol-01`, role VOLUNTEER),
  and the production seed recorded on 2026-08-15 falls in that range. It appears in no current
  file, and the brief that prompted this named five ids and not it. A refusal keyed on the ids in
  the current code would have left it working. Whether the row is still there is not observable
  from the repo.
  The password list is append-only for the same reason: removing a seed unpublishes nothing.
- **What the public repo compromised is the password.** Keyed on it, one check covers every store
  that can hold the account — Postgres rows, the in-memory seed, a future reseed that resets the
  hash — and any other account someone set one of these passwords on.
- **Not because it spares the account.** The brief argued the password refusal "doesn't lock out a
  real owner". On current code it does, exactly as hard as an id refusal would: no action changes
  an ACTIVE account's password (`resendInvitation` requires INVITED; `toggleMemberStatus` cannot
  set INVITED). The seeded accounts become unusable in production either way. The difference is
  only that a password-change feature, if one is built, would bring them back.

## Why only the login refusal is keyed on `NODE_ENV`

`tasks/lessons/2026-08-28-environment-keyed-dev-bypasses-in-security-gatekeepers-create-silent.md`
says gatekeepers must be invariant across environments. Refusing these passwords at sign-in
everywhere would end the offline demo, which is a real purpose (`sponsorRepository.ts:35-40`), and
the unit and e2e tiers that rely on it. So the set-time refusal is invariant — nobody needs to
*choose* a published password anywhere — and the sign-in refusal follows the precedent the DAL
already set for the same seed. `next build` and `next start` default `NODE_ENV` to `production`
(`node_modules/next/dist/bin/next:65-84`); a deployment run with `next dev`, or with `NODE_ENV`
overridden, is not covered, and neither is any other guard in this repo keyed the same way.

## Considered and not done

- **Stop seeding `userStore` in production** (the `SEEDING_ENABLED` shape). With the sign-in
  refusal the in-memory seed cannot authenticate there, so it would add a second guard for the same
  hole. The reachable-but-unseeded development case also depends on that seed (`dal.ts`).
- **Refuse published passwords whenever `DATABASE_URL` is non-local**, in development too. It would
  also stop a local `next dev` on `.env.local` signing in to production as `usr-admin-01`, but it
  changes the operator's own workflow and the e2e half of that hazard is closed separately. Left
  for the user to ask for.

## What this does not fix

The rows. Anyone who signed in before this deploys holds a cookie valid for up to 24 hours;
suspending the seeded rows revokes it on a reachable database, and rotating `SESSION_SECRET`
revokes every session regardless. Both are production actions for the operator, not code.
