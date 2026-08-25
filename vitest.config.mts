import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
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
          include: ["tests/integration/**/*.test.{ts,tsx}"],
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
          name: "components",
          environment: "jsdom",
          // Tier 4: client components only. Reports "no tests" until Task 02
          // lands, which is a pass, not a failure.
          include: ["tests/components/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
