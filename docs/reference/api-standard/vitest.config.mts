import { defineConfig } from "vitest/config";

/**
 * Self-contained config so the reference kit runs without touching the host project's
 * vitest setup (whose `include` is scoped to its own tests/ directory).
 *
 *   npx vitest run --config docs/reference/api-standard/vitest.config.mts
 */
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["docs/reference/api-standard/tests/**/*.test.ts"],
  },
});
