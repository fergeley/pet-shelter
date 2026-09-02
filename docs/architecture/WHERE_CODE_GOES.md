# Where Code Goes

One page. For the *why*, see [LAYERS.md](LAYERS.md).

---

## The rule

**A file's directory says where its code may run.** That is the whole idea.

| Directory | Runs | Put here |
|---|---|---|
| `src/lib/server/` | Server only | Anything touching Prisma or the fixture caches |
| `src/lib/client/` | Browser only | localStorage hooks, canvas, anything needing `window` |
| `src/lib/presentation/` | Either | Status → colour/label. Pure functions, no data fetching |
| `src/lib/domain/` | Either | Business rules and maths. No I/O at all |
| `src/lib/security/` | Server only | Sessions, passwords, RBAC, rate limiting |
| `src/lib/validations/` | Either | Zod schemas |

Five files sit at the root of `src/lib/` on purpose: `utils.ts` (the `cn` helper),
`email.ts` (outbound service), `persistenceMode.ts` (read by every repository), plus the
`i18n/` and `storage/` directories. Everything else belongs in one of the boxes above.

---

## Deciding in ten seconds

1. **Does it touch the database?** → `server/`
2. **Does it need `window`, `document`, or `localStorage`?** → `client/`
3. **Does it turn a domain value into something visual?** → `presentation/`
4. **Is it a rule or a calculation with no I/O?** → `domain/`
5. **Still unsure?** → it is probably doing two jobs. Split it.

Point 5 is not a joke. `medicalTimeline.ts` sat in `src/lib/` for months doing timeline
synthesis *and* colour mapping. It became two files.

---

## What the tests enforce

`tests/unit/layerBoundaries.test.ts` fails CI on any of these:

- Anything outside `server/` importing Prisma (except `domain/auditLog.ts`)
- A `"use server"` module reaching client code
- A `"use client"` module reaching `server/`
- A non-client module reaching `client/`
- `presentation/` reaching `server/`

These run on the import graph, so you find out at test time, not in production.

**If you add a rule here, break it once on purpose and watch it fail.** A guard that has
never been seen red is not known to work — one here silently enforced nothing because it
could not see `import "x";` statements.

---

## Two conventions that live nowhere else

- **No barrel files.** Import the concrete path: `@/lib/server/petRepository`, never a
  re-exporting `index.ts`. Barrels were added once and removed the next commit.
- **Conventional Commits with a scope**: `feat(ui):`, `refactor(lib):`, `docs:`, `build:`.

---

## Two traps this codebase has actually hit

**Moving a file breaks its relative imports, silently.** `import { x } from "./y"` resolves
differently at a new depth. `tsc` catches most of it — but if the wrong path happens to
exist, nothing complains. When you move a file, grep it for `from "."` before anything else.

**Database errors are swallowed.** `server/` falls back to `src/data/*.json` on any failure,
so a write can report success and persist nothing. If a write "worked" but the row is
missing, suspect the fallback before the caller. Set `STRICT_PERSISTENCE=true` to make it
throw instead.

---

## Checks before you commit

```bash
npx tsc --noEmit    # must be clean
npm test            # 41 files / 524 tests
npm run lint        # 0 errors (4 known warnings in PetFormDialog)
```
