import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  // `server-only` is resolved by Next at build time and is not an npm dependency
  // here, so the sponsor data-access layer that imports it needs a stub to load.
  "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
};

/**
 * Shared by every project below. Kept as one object so a project cannot quietly
 * drift onto a different alias table or skip the global mock harness.
 */
const shared = {
  globals: true,
  setupFiles: ["./tests/setup/nextMocks.ts"],
  passWithNoTests: true,
};

export default defineConfig({
  resolve: { alias },
  test: {
    // Tier 3 (`tests/integration`) and Tier 4 (`tests/components`) fill up over
    // Tasks 02 and 03. Until a tier has files, vitest exits 1 on an empty run,
    // which would red-light CI for work that is merely not written yet rather
    // than broken. Needed at the root as well as per-project: the "nothing
    // matched at all" check runs before any project config is consulted.
    passWithNoTests: true,

    // Environment and env-var routing is per-project rather than
    // `environmentMatchGlobs`: that option was deprecated in Vitest 3 and
    // REMOVED in Vitest 4 (this repo runs 4.1.10), where it is silently ignored
    // rather than reported. Projects are the supported replacement.
    projects: [
      {
        resolve: { alias },
        test: {
          ...shared,
          name: "unit",
          environment: "node",
          // Tiers 1-2: domain logic and architectural guards. Server Components
          // and Server Actions are deliberately NOT rendered in jsdom — see the
          // "Server Component / jsdom Trap" in
          // docs/tasks/TESTING_STRATEGY_AND_MULTI_AGENT_PLAN.md.
          include: ["tests/unit/**/*.test.{ts,tsx}"],
        },
      },
      {
        resolve: { alias },
        test: {
          ...shared,
          name: "integration",
          environment: "node",
          // Single-level glob on purpose. `tests/integration/db/` holds the
          // Tier-3b suites that require a reachable Postgres; they belong to the
          // `integration-db` project below and must not be swept up here, or
          // every run without a database goes red. Narrowing `include` rather
          // than setting `exclude` keeps Vitest's default exclude list (which
          // covers node_modules and dist) intact — assigning `exclude` replaces
          // those defaults rather than adding to them.
          include: ["tests/integration/*.test.{ts,tsx}"],
          // Strict persistence is a property of this tier, not of the command
          // that launched it. Declaring it here means `npm run test:integration`,
          // `npm run test:all`, a bare `vitest` watch, and an IDE run all get it.
          // Relying solely on `cross-env` in the npm script would let `test:all`
          // run these specs against the forgiving in-memory fallback and report
          // green while verifying nothing — the exact failure mode this tier
          // exists to prevent.
          env: { STRICT_PERSISTENCE: "true" },
        },
      },
      {
        resolve: { alias },
        test: {
          ...shared,
          name: "integration-db",
          environment: "node",
          include: ["tests/integration/db/**/*.test.{ts,tsx}"],

          // Prepended, not appended: `nextMocks.ts` imports the repositories in
          // its `beforeEach`, and those construct the Prisma pool from
          // `DATABASE_URL`. Loading `.env.local` after it would hand Prisma the
          // hardcoded `localhost:5432` fallback, and every assertion below would
          // then fail against a refused connection instead of the real schema —
          // which is indistinguishable from a genuine schema failure.
          setupFiles: ["./tests/setup/integrationEnv.ts", ...shared.setupFiles],

          // Tier 3b: the only suites that talk to a real PostgreSQL server.
          //
          // Opt-in, via `npm run test:db`, and deliberately NOT part of
          // `npm run test:all`. Every other tier runs anywhere — the app is
          // designed to work with no database at all — so folding these in would
          // make a green tree depend on Docker being up, and CI would fail for a
          // missing container rather than a broken change.
          //
          // The opposite mistake is the more dangerous one, so these suites
          // *fail* rather than skip when `DATABASE_URL` is unset. A skip reads as
          // a pass in the summary line, which is precisely how "verified against
          // Postgres" became a claim nobody had actually tested.
          //
          env: { STRICT_PERSISTENCE: "true" },

          // These suites share one database, so they must not race each other
          // over the same receipt-sequence rows.
          fileParallelism: false,
        },
      },
      {
        resolve: { alias },
        test: {
          ...shared,
          name: "components",
          environment: "jsdom",
          // Tier 4: client components only.
          include: ["tests/components/**/*.test.{ts,tsx}"],

          // Vitest's 5s default is a node-lane number. Mounting a Base UI
          // dialog in jsdom and driving it with `user-event` — which advances a
          // real timer per keystroke — costs seconds per test, and with four
          // files in parallel the slowest legitimately crossed 5s and failed for
          // load rather than for behaviour. Raised rather than worked around,
          // because trimming the interactions to fit would mean testing less.
          testTimeout: 20_000,

          // Appended, so `nextMocks.ts` still wins the ordering it documents.
          // This half is strictly jsdom-shaped — jest-dom matchers, RTL
          // `cleanup()`, and the browser APIs jsdom omits — and must not reach
          // the node lanes, where `document` does not exist.
          setupFiles: [...shared.setupFiles, "./tests/setup/componentSetup.ts"],
        },
      },
    ],
  },
});
