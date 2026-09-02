import { defineConfig, devices } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Tier 5 — golden-path browser journeys.
 *
 * Loaded before anything else here: the auth fixture seals a real session
 * cookie with `SESSION_SECRET`, and the app itself needs `DATABASE_URL`. Neither
 * Playwright nor Vitest reads `.env.local` on its own — that is a Next.js
 * behaviour — so without this the fixture would sign sessions with the insecure
 * development fallback while `next dev` signed them with the real secret, and
 * every authenticated spec would be silently rejected as a forgery.
 */
for (const filename of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), filename);
  if (existsSync(path)) loadDotenv({ path, quiet: true });
}

/**
 * Defaults to 3100 rather than 3000 so a run cannot collide with a dev server
 * someone already has open — including one belonging to another agent session
 * on this machine.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e/specs",

  // Vitest owns `tests/`; keeping the two roots disjoint is what stops each
  // runner from collecting the other's files and failing on unknown globals.
  fullyParallel: false,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  // One worker: the specs share a single database and a single shelter
  // catalogue, so a parallel admin mutation would change what a public spec
  // sees mid-assertion.
  workers: 1,

  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    // Artifacts on failure only — a green run should leave nothing behind.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // `next dev` rather than `build && start`: the specs assert on rendered
    // content, not on production bundling, and a dev server removes a
    // multi-minute build from every local run.
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    // Locally, attach to whatever is already listening. In CI there is never a
    // pre-existing server, and reusing one would mask a broken start.
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
