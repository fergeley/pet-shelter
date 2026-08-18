@AGENTS.md

# Hope for Strays — Project Guide

Bilingual (English / Bahasa Malaysia) rescue & adoption platform for **Hope for Strays**
(*Persatuan Harapan Haiwan Terbiar Selangor*), a registered Malaysian animal-welfare NGO in
Petaling Jaya, Selangor. Public catalog + adoption applications + donations/sponsorship +
staff admin portal, in one Next.js app.

**Stack**: Next.js 16.3.1 (App Router, Turbopack) · React 19.2.8 · TypeScript 5 strict ·
Tailwind CSS v4 + shadcn (`base-sera` style) + `@base-ui/react` · Prisma 7.9.1 + PostgreSQL
(`@prisma/adapter-pg`, Neon or local Docker) · Zod 4 · Vitest 4 · Resend (email).

## Commands

```bash
npm run dev            # next dev (Turbopack)
npm run build          # prisma generate && next build
npm test               # vitest run  — 25 files / 221 tests, all green
npm run test:watch     # vitest
npm run lint           # eslint (flat config, eslint-config-next)
npx tsc --noEmit       # strict typecheck — clean; scratch/ is included, see below
npm run db:push        # prisma db push
npm run db:seed        # tsx prisma/seed.ts
docker compose up -d   # local Postgres 16 on :5432 (postgres/postgrespassword/pet_shelter)
```

- `prisma generate` runs automatically on `postinstall` and `prebuild`.
- Vitest 4 removed the `basic` reporter — `vitest run --reporter=basic` crashes. Use the default.
- No `DATABASE_URL` is required to run or test: every DB read falls back to in-memory fixtures.

## Architecture

```
src/actions/      "use server" Server Actions — the app's entire write/query API surface
src/app/          App Router pages (async Server Components) + /api/upload route handler
src/components/   layout/ · providers/ · features/{pets,adoptions,donations,bulletins} · admin/ · ui/
src/hooks/        use*Controller.ts — client state/logic pulled out of components
src/lib/          domain logic, security, i18n, stores, services, validations
src/data/         JSON fixtures (pets, applications, bulletins, faqs, rehabNeeds) = fallback dataset
src/types/        shared TS contract (pet, application, bulletin, match, sponsorship)
tests/unit/       Vitest (node environment, `@/` alias, no DOM)
docs/             architecture blueprints, runbooks, tutorials, sprint plan — start at docs/README.md
```

### Data flow (the pattern to follow)

Server Component page → `await someAction(...)` from `src/actions/*` → `src/lib/serverStore.ts`
→ Prisma → **falls back to in-memory arrays on any error or empty table**. Interactive UI lives in
`"use client"` components that call the same actions and keep local state in a `use*Controller` hook.

### Dual-layer store (most important convention)

`src/lib/serverStore.ts` wraps every Prisma call in try/catch. On failure — or when the table is
empty — it returns module-level arrays seeded from `src/data/*.json`. Consequences:

- The app, admin portal, and tests work with no database at all.
- **DB errors are swallowed** (a `console.warn` in development only). If a write "succeeds" but
  doesn't persist, suspect the fallback path, not the caller.
- Writes mutate both the DB and the in-memory array, so behaviour stays consistent within a process.

Do not confuse `serverStore.ts` with the *client* stores (`petStore`, `applicationStore`,
`bulletinStore`, `settingsStore`, `sponsorshipStore`, `userStore`). Those are `"use client"` React
hooks persisting to `localStorage` under `hope_for_strays_*` keys — used by admin/demo UI only.

### Security (`src/lib/security/`)

- **Sessions** — not JWT. `sealSession` builds `base64url(payload).hmac` signed with `SESSION_SECRET`,
  stored in the HTTP-only `hope_shelter_session` cookie, 24 h expiry.
- **Passwords** — `crypto.scrypt` with per-user salt, verified via `timingSafeEqual`. (README says
  bcrypt; the code uses scrypt.)
- **RBAC** — roles `ADMIN | COORDINATOR | STAFF | VOLUNTEER`; `assertAuthorized(user, roles)` throws
  `UnauthorizedError` / `ForbiddenError`. `verifyAdminSession()` in `src/lib/auth.ts` also accepts a
  legacy `admin_session` cookie matching `ADMIN_SECRET_KEY`.
- **Rate limiting / idempotency** — in-memory `Map`, sliding window (login: 5/min). Per-process only;
  does not survive restarts or scale horizontally.
- `src/app/admin/layout.tsx` guards routes **client-side only**. Every admin Server Action must
  re-check authorization itself — never rely on the layout.

### Domain rules

- `src/lib/domain/stateMachine.ts` — legal status transitions for applications
  (`SUBMITTED → UNDER_REVIEW → APPROVED|REJECTED`) and pets; illegal moves throw `DomainValidationError`.
- `src/lib/domain/auditLog.ts` — `recordAuditLog(...)` on every privileged mutation; surfaced at `/admin/audit`.
- Pets are **soft-deleted** (`isArchived` + `deletedAt`); public queries filter archived rows out.

### i18n

Zero-dependency, type-safe: `src/lib/i18n/translations.ts` (~1000 lines) defines
`TranslationDictionary` plus the `en` and `ms` dictionaries; `LanguageProvider` + `useLanguage`
persist choice to `localStorage` and a `SameSite=Lax` cookie. Adding a string means touching three
places — the interface and both dictionaries. `tests/unit/i18n.test.ts` enforces key parity, so a
half-added key fails CI. User-facing copy belongs in the dictionary, never inline in JSX.

## Conventions

- Imports use the `@/` alias, always to a concrete file path. The four barrels (`@/lib/stores`,
  `@/lib/security`, `@/lib/services`, `@/components`) have **zero importers**, and
  `@/lib/security` re-exports a `"use client"` module — don't reach for them from server code
  without reading `docs/architecture/LAYERS.md` §5.
- Strict TypeScript, no `any`. Validate all external input with Zod schemas in `src/lib/validations/`.
- Commits: Conventional Commits with a scope — `feat(ui):`, `refactor(lib):`, `docs:`, `build:`.
- Tests are node-environment only (no jsdom) — test logic in `lib/`, not React rendering.
- Remote images must have their host allow-listed in `next.config.ts` → `images.remotePatterns`.
- Malaysian domain facts are load-bearing in copy and receipts: LHDN Sec 44(6) tax-deductible ref
  `LHDN.01/35/42/51/179-6.4912`, ROS reg `PPM-012-10-18042016`, DuitNow QR, PDPA 2010, MYR amounts.

## Work in progress

The tree is mid-way through the TNRM / rehabilitation sprint
(`docs/tasks/SPRINT_PLAN_BACKEND_AND_FRONTEND.md`). `npx tsc --noEmit` is clean and all tests pass;
what remains is data-layer propagation, not type errors.

- `PetStatus` includes `'In Rehabilitation'` plus the legacy alias `'Rehabilitation'`. Treat
  `'In Rehabilitation'` as canonical and run statuses through `normalizePetStatus()`
  (`src/lib/domain/stateMachine.ts`) before comparing them — never compare raw strings.
  Rehab transitions: an animal may enter rehab from `Available` or `Pending`, and leaves it only
  via veterinary clearance back to `Available` (no direct adoption out of rehab).
- `rehabStage`, `rehabStageMs`, and `rehabProgressPercent` have Prisma columns, `serverStore` row
  mappings, and seed coverage. **Re-run `npx prisma generate` after pulling** — a stale client
  rejects writes carrying those fields, and the fallback swallows the error.
- `pet-009` (Tuah) and `pet-010` (Comel) in `src/data/pets.json` are the rehab fixtures; run
  `npm run db:seed` to get them into Postgres.
- **Still pending**: `Pet.updates[]` has no `PetUpdate` model and no mapper, so it lives only in the
  JSON fixtures. No UI yet either — `PetCard` only branches on `Available`, and the `PetGallery`
  status filter offers no rehab option, so rehab animals render as ordinary unavailable cards.
  (`medicalTimeline[]` predates this work and is synthesized deterministically by
  `src/lib/medicalTimeline.ts` when absent.)
- `src/data/faqs.json` and `src/data/rehabNeeds.json` are bilingual fixtures with no reader or
  action wired up yet; the donate page and `PetsFaqSection` still hardcode FAQ arrays inline.
- `scratch/` is scratch work but is type-checked (tsconfig includes `**/*.ts`), so errors there
  break `tsc` for the whole project. Keep it compiling or exclude it.

## Environment

Copy `.env.example` → `.env.local`. Notable: `DATABASE_URL` (Neon or local Docker),
`SESSION_SECRET` (≥32 chars in production), `ADMIN_SECRET_KEY`, `RESEND_API_KEY` + `SENDER_EMAIL`
(email silently simulates without a key), `STORAGE_PROVIDER` (`local` default, or `s3` /
`cloudinary` — see `src/lib/storage/index.ts`), `PRISMA_LOG=true` for query logging.
Uploads land in `public/uploads/` locally and are git-ignored.
