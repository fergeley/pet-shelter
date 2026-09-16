import * as dotenv from "dotenv";

/**
 * Single source of truth for how database-touching scripts resolve `DATABASE_URL`.
 *
 * ## Why this module exists
 *
 * `prisma.config.ts` and `prisma/seed.ts` used to resolve the connection string
 * independently, and they disagreed:
 *
 * - `prisma.config.ts` loaded `.env.local`, then `.env`.
 * - `prisma/seed.ts` used `import "dotenv/config"`, which loads `.env` **only** —
 *   and this repo has no `.env`, only `.env.local` (see `.gitignore`, which
 *   ignores `.env*` and re-includes `.env.example`).
 *
 * So `npm run db:push && npm run db:seed` pushed the schema to whatever
 * `.env.local` named — a hosted Neon branch on a developer machine — and then
 * seeded the localhost fallback baked into the seed script. Both commands exit 0.
 * The pair looks like a passing end-to-end verification while the two halves have
 * never met the same database, and the half that ran against Neon was a schema
 * mutation against shared infrastructure.
 *
 * Everything that needs a connection string calls `resolveDatabaseUrl()` here, so
 * the two cannot drift apart again.
 */

/**
 * Where a developer running `docker compose up -d` will find Postgres. The
 * credentials mirror `docker-compose.yml`; changing one without the other is the
 * next version of the bug this module exists to prevent.
 */
export const LOCAL_DATABASE_URL =
  "postgresql://postgres:postgrespassword@localhost:5432/pet_shelter?schema=public";

/**
 * Loads the env files in priority order: `.env.local` wins over `.env`.
 *
 * `dotenv.config()` does **not** overwrite a variable that is already present in
 * `process.env`, so a `DATABASE_URL` exported by the shell beats both files. That
 * precedence is load-bearing rather than incidental: it is what lets
 * `npm run db:push:local` pin localhost for one command without editing
 * `.env.local`, which holds real credentials and must not be rewritten by tooling.
 */
export function loadDatabaseEnv(): void {
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env" });
}

/** The connection string every database command should use. */
export function resolveDatabaseUrl(): string {
  loadDatabaseEnv();
  return process.env.DATABASE_URL || LOCAL_DATABASE_URL;
}

/**
 * Hostnames that are unambiguously a throwaway database on this machine.
 *
 * Deliberately an allow-list. A deny-list of known hosted providers would pass
 * anything it had not heard of, and the failure mode of guessing wrong here is
 * destroying rows in someone's shared database.
 */
const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "host.docker.internal",
]);

/** True when `url` points at Postgres on this machine. Unparseable URLs are not local. */
export function isLocalDatabaseUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Refuses to seed anything that is not a local database.
 *
 * `prisma/seed.ts` is not additive. It calls `deleteMany` on `pet_updates` and
 * `medical_timeline_events` for every fixture pet before re-creating them, and it
 * upserts over user, pet, and application rows. Aimed at a shared or hosted
 * database that is destructive, and the operator gets no confirmation prompt
 * because the seed is designed to run unattended from an npm script.
 *
 * The escape hatch is a deliberate, typed-out `ALLOW_REMOTE_SEED=true`. Someone
 * provisioning a fresh staging branch has a legitimate reason to seed it; the
 * point is that they must say so, rather than inheriting the target from whatever
 * `.env.local` happened to contain.
 */
export function assertSeedTargetIsLocal(url: string): void {
  if (isLocalDatabaseUrl(url) || process.env.ALLOW_REMOTE_SEED === "true") {
    return;
  }

  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "<unparseable>";
    }
  })();

  throw new Error(
    [
      `Refusing to seed a non-local database (host: ${host}).`,
      "",
      "`npm run db:seed` deletes and re-creates pet history rows, so pointing it at a",
      "hosted or shared database destroys real data.",
      "",
      "To seed the local Docker database:",
      "",
      "  npm run db:up && npm run db:seed:local",
      "",
      `To seed ${host} on purpose:`,
      "",
      "  ALLOW_REMOTE_SEED=true npm run db:seed",
    ].join("\n")
  );
}

/**
 * The `DATABASE_URL` the Playwright web server is started with.
 *
 * The configured URL survives only when it is local, or when the caller has opted in with
 * `E2E_ALLOW_REMOTE_DATABASE=true`. Anything else becomes `""`, which runs the app on its
 * in-memory fallback — the mode every spec already passes in.
 *
 * `playwright.config.ts` loads `.env.local`, which points at the Neon production branch on
 * the one machine that has it, and the specs submit applications, issue donation receipts,
 * and archive pets. On 2026-09-14 three ordinary local runs wrote 27 rows to production that
 * way and spent receipt numbers `HFS-DON-202609-0001` to `0003`.
 *
 * `""` rather than `undefined` on purpose: `next dev` reads `.env.local` for itself and fills
 * any variable that is *absent*, but leaves one that is present and empty alone.
 */
export function resolveE2eDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  const url = env.DATABASE_URL ?? "";
  if (url === "" || isLocalDatabaseUrl(url) || env.E2E_ALLOW_REMOTE_DATABASE === "true") {
    return url;
  }
  return "";
}
