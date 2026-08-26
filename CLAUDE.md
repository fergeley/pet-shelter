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
npm test               # vitest run --project unit  — 39 files / 512 tests, all green
npm run test:watch     # vitest
npm run test:unit      # Tiers 1-2: domain logic + architectural guards (node)
npm run test:components # Tier 4: client components (jsdom)
npm run test:integration # Tier 3: Server Actions under STRICT_PERSISTENCE=true
npm run test:all       # every tier
npm run lint           # eslint (flat config, eslint-config-next)
npx tsc --noEmit       # strict typecheck — clean; scratch/ is excluded
npm run db:push        # prisma db push
npm run db:seed        # tsx prisma/seed.ts
docker compose up -d   # local Postgres 16 on :5432 (postgres/postgrespassword/pet_shelter)
```

- `prisma generate` runs automatically on `postinstall` and `prebuild`.
- Vitest 4 removed the `basic` reporter — `vitest run --reporter=basic` crashes. Use the default.
  It also removed `environmentMatchGlobs`; `vitest.config.mts` routes environments through
  `test.projects` (`unit`/`integration` = node, `components` = jsdom) instead.
- No `DATABASE_URL` is required to run or test: every DB read falls back to in-memory fixtures.

### Testing harness

`tests/setup/nextMocks.ts` loads before every test file (`setupFiles`) and provides:

- Overload-aware `next/headers` (`cookies()` accepts both `set(name, value, opts)` and
  `set({ name, value, ...opts })`; `maxAge: 0` expires rather than writes), `next/cache`
  (`revalidatePath`/`revalidateTag`/`updateTag` spies plus `getRevalidatedPaths()`), and
  `next/navigation` (`redirect`/`notFound` **throw**, as the real ones do).
- A global `beforeEach` that resets every module-level cache: `resetServerStore()`,
  `resetUserStore()`, `resetAuditLogs()`, `resetRateLimitStore()`, `resetIdempotencyStore()`,
  `resetDonationLedger()`.
  New suites are order-independent by default; don't re-implement this per file.
- Those stores are imported **dynamically inside the hook**. A static import would instantiate
  the repositories — and the real `@/lib/prisma` — before a test file's own
  `vi.mock("@/lib/prisma")` registers, so Prisma spies would silently observe zero calls.
  `resetServerStore()` now lives in `@/lib/server/fallbackState`, which is the only module that
  knows all four caches exist.

A test file's own `vi.mock("next/headers", ...)` still wins over the harness for that file; five
suites predate the harness and rely on that.

**`STRICT_PERSISTENCE=true`** (`src/lib/persistenceMode.ts`) turns off the fallback so a failing
query throws instead of quietly serving fixtures. It is declared on the `integration` project in
`vitest.config.mts`, not just via `cross-env`, so `npm run test:all` can't run Tier 3 against the
forgiving path and report green. `recordAuditLog` is fire-and-forget, so its failures surface
through `await flushAuditLogWrites()` rather than a throw at the call site.

## Architecture

```
src/actions/      "use server" Server Actions — the app's entire write/query API surface
src/app/          App Router pages (async Server Components) + /api/upload route handler
src/components/   layout/ · providers/ · features/{pets,adoptions,donations,bulletins} · admin/ · ui/
src/hooks/        use*Controller.ts — client state/logic pulled out of components
src/lib/          server/ (repositories) · client/ (localStorage hooks) · presentation/ (status → tone)
                  · domain/ · security/ · validations/ · i18n/ · storage/ — the first three are
                  guarded by tests/unit/layerBoundaries.test.ts, not just convention
src/data/         JSON fixtures (pets, applications, bulletins, faqs, rehabNeeds) = fallback dataset
src/types/        shared TS contract (pet, application, bulletin, match, sponsorship)
tests/unit/       Vitest (node environment, `@/` alias, no DOM)
docs/             architecture blueprints, runbooks, tutorials, sprint plan — start at docs/README.md
```

### Data flow (the pattern to follow)

Server Component page → `await someAction(...)` from `src/actions/*` → `src/lib/server/*`
→ Prisma → **falls back to in-memory arrays on any error or empty table**. Interactive UI lives in
`"use client"` components that call the same actions and keep local state in a `use*Controller` hook.

### The repository layer (`src/lib/server/`)

Six modules, split out of the former 883-line `serverStore.ts`:

| Module | Role |
|---|---|
| `petRepository.ts` | pet cache + Prisma reads/writes; owns `serverPets` |
| `applicationRepository.ts` | application cache + Prisma reads/writes; owns `serverApplications` |
| `petMappers.ts` | pure row ↔ domain projection. **No Prisma, no cache** |
| `rehabNeedsCatalog.ts` · `faqCatalog.ts` | fixture-only readers. **No Prisma model exists** — they are catalogs, not repositories |
| `fallbackState.ts` | composition root; exports the single `resetServerStore()` |

Approving an application cascades to the pet, so `applicationRepository` imports
`markCachedPetAdopted` from `petRepository`. That dependency is **one-way and must stay so** — pet
writes never touch applications. `tests/unit/layerBoundaries.test.ts` additionally forbids any
`"use client"` module from importing `src/lib/server/*`.

### Dual-layer store (most important convention)

`petRepository.ts` and `applicationRepository.ts` wrap every Prisma call in try/catch. On failure —
or when the table is empty — they return module-level arrays seeded from `src/data/*.json`.
Consequences:

- The app, admin portal, and tests work with no database at all.
- **DB errors are swallowed** — reads warn in development only, writes warn always (a lost write is
  data loss). If a write "succeeds" but doesn't persist, suspect the fallback path, not the caller.
  Set `STRICT_PERSISTENCE=true` to make them throw instead; see "Testing harness" above.
- Writes mutate both the DB and the in-memory array, so behaviour stays consistent within a process.

Do not confuse `src/lib/server/` with the *client* stores in `src/lib/client/` (`petStore`, `applicationStore`,
`bulletinStore`, `settingsStore`, `sponsorshipStore`, `adminAuth`). Those are `"use client"` React
hooks persisting to `localStorage` under `hope_for_strays_*` keys — used by admin/demo UI only.

### The ledger exception (`src/lib/donationLedger.ts`)

Donation receipts deliberately **do not** use the dual-layer fallback. The fallback is coherent for
*reference data* (pets, FAQs, needs) because each has an authoritative committed fixture; a donation
records that an external event happened — money moved — and there is no fixture for an event that
hasn't occurred. Swallowing that write would hand a donor an official LHDN receipt number for a row
that exists nowhere.

So the ledger uses a **declared mode** instead of an implicit fallback:

- `DATABASE_URL` set → Postgres is authoritative; a failed write throws `ReceiptIssuanceError`, the
  Server Action reports failure, and **no receipt is issued**.
- `DATABASE_URL` unset → the in-memory ledger is authoritative (the documented offline mode). Still
  gapless, just per-process.

Reads keep the usual asymmetry: a failed listing returns `[]` and warns.

Two properties are structural, not conventional:

- **Gapless numbering** — `ReceiptSequence` is a counter row incremented in the *same transaction*
  as the insert, so a number is consumed iff the receipt exists. A Postgres `SEQUENCE` cannot do
  this (a rolled-back txn burns its value), and a hole in a statutory series reads to an auditor as
  a destroyed receipt. `@@unique([sequenceScope, sequenceValue])` is the real guarantee.
- **Append-only** — no update/delete is exported and `Donation` has no `updatedAt`. Corrections are
  new offsetting rows. `prisma/sql/donation_append_only.sql` adds the matching DB trigger (opt-in).

Money is **integer sen**, never `Float` and never Prisma `Decimal` — see `src/lib/domain/money.ts`
for why (`Decimal` does not survive the `"use server"` boundary intact). Convert at the edges with
`senFromRinggit` / `ringgitFromSen`; `Sen` is a branded type so the 100× mistake is a compile error.

Statutory identifiers live in `src/lib/domain/shelterIdentity.ts`, and each `Donation` row snapshots
the ones it was issued under — the same point-in-time capture as `AdoptionApplication.petName`.
**The ROS registration number discrepancy (P2) is still unresolved and blocked on the certificate**;
the two variants are now side by side in that one file instead of scattered across six.

New tables: run `npm run db:push` after pulling, or `donation.create` fails and, because this path
does not fall back, the donation fails too — which is the intended behaviour.

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

### Design system (`src/app/globals.css`)

Three layers, in this order: **tokens** (`:root` / `.dark` / `@theme inline`), **base** (element
defaults), **components** (`@layer components`). Rules:

- **Never write a raw palette utility** — no `bg-emerald-800`, `text-zinc-500`, `#ed008c`. Pick a
  *meaning* from the seven tones: `success` · `warning` · `info` · `care` (rehabilitation) ·
  `danger` · `highlight` (no fixed meaning — the extra distinguishable colour, reach for it
  last) · `neutral` (adopted/archived). Each exposes seven slots:
  `surface` `surface-strong` `border` `text` `accent` `solid` `on-solid`, e.g.
  `bg-success-surface`, `text-care-accent`, `border-warning-border`.
- **Never hand-write a `dark:` variant for colour.** Every token is declared in both `:root` and
  `.dark`, so `bg-info-surface` already flips. A `dark:` next to a token means the token is wrong.
- **Shells over class soup.** `tone-soft` (tinted surface — colour only, the caller keeps its own
  box), `tone-panel-strong` (emphasised surface), `tone-chip` / `tone-chip-pill` (status badge),
  `tone-pill` (decision pill), `tone-ink` (tone-coloured icon), `eyebrow` (uppercase micro-label),
  `segmented` / `segmented-thumb` (toggles), `receipt*`. Pair a shell with a tone class:
  `class="tone-soft tone-care"`. Every class in that layer has a live consumer — if you add one,
  use it, and if a use disappears, delete it.
- **Component classes take no variants.** `dark:tone-ink` and `hover:eyebrow` compile to nothing —
  only Tailwind-generated utilities accept variants.
- **Status colour comes from the presentation modules, never the component.**
  `@/lib/petStatusPresentation`, `@/lib/applicationStatusPresentation`, `@/lib/medicalTimeline` and
  `BulletinFeed`'s `CATEGORY_LABELS` each map their domain states onto a tone and hand back a ready `toneClass` / `chipClass` /
  `badgeClass` / `pillClass`. Those strings are self-contained — adding `px-*` or `text-white` at
  the call site is what the unit tests forbid.
- **Type scale** runs `text-3xs` (10px) · `text-2xs` (11px) · `text-xs` … — no `text-[10px]`.
  **Radii**: `rounded-sm`…`rounded-4xl` derive from `--radius`, plus named `rounded-mark`,
  `rounded-control`, `rounded-card`, `rounded-dialog`. **Elevation**: `shadow-brand-xs…xl`.
- **Two deliberate exceptions.** The printed receipt uses `--receipt-*` tokens that are *absent
  from `.dark`* — a Sec 44(6) receipt is black ink on white paper in every theme. And HTML email
  (`src/lib/email.ts`, `src/actions/settings.ts`) keeps literal hex, because mail clients support
  neither CSS custom properties nor Tailwind.

## Conventions

- Imports use the `@/` alias to concrete file paths (no barrels).
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

**Next schema work**: `docs/tasks/TARGET_SCHEMA_TYPE_INTEGRITY.md` — why 5NF is the wrong goal for
this schema, the `Pet.age` value that silently rots, statuses Postgres cannot constrain, the one real
3NF violation, and the four typed concepts with no persistence. It also records the standing gap that
**the donation ledger has never run against real Postgres** (no Docker in the authoring session);
`docker compose up -d && npm run db:push && npm run db:seed` is the first thing to do about it.

- `PetStatus` includes `'In Rehabilitation'` plus the legacy alias `'Rehabilitation'`. Treat
  `'In Rehabilitation'` as canonical and run statuses through `normalizePetStatus()`
  (`src/lib/domain/stateMachine.ts`) before comparing them — never compare raw strings.
  Rehab transitions: an animal may enter rehab from `Available` or `Pending`, and leaves it only
  via veterinary clearance back to `Available` (no direct adoption out of rehab).
- `rehabStage`, `rehabStageMs`, and `rehabProgressPercent` have Prisma columns, `petMappers.ts` row
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
- `scratch/` is excluded from both `tsconfig.json` and `eslint.config.mjs`. It used to fall inside
  tsconfig's `**/*.ts` include, so a stray error there broke `tsc` for the whole project.

## Environment

Copy `.env.example` → `.env.local`. Notable: `DATABASE_URL` (Neon or local Docker),
`SESSION_SECRET` (≥32 chars in production), `ADMIN_SECRET_KEY`, `RESEND_API_KEY` + `SENDER_EMAIL`
(email silently simulates without a key), `STORAGE_PROVIDER` (`local` default, or `s3` /
`cloudinary` — see `src/lib/storage/index.ts`), `PRISMA_LOG=true` for query logging.
Uploads land in `public/uploads/` locally and are git-ignored.
