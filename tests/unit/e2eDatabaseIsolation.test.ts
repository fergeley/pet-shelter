import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveE2eDatabaseUrl } from "../../prisma/env";
import { snapshotProcessEnv } from "../support/envFiles";

/**
 * Local e2e cannot reach a database that is not on this machine.
 *
 * `playwright.config.ts` loads `.env.local`, which on the machine that has one points at the
 * Neon production branch, and `next dev` inherited it. On 2026-09-14 three local runs wrote 27
 * rows to production: fake adoption applications, three RM30 donations holding real receipt
 * numbers, and archive/restore of a real pet. Every URL here is invented; nothing connects.
 */

const REMOTE_URL = "postgresql://e2e:e2e@ep-fake-remote-000.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const CI_URL = "postgresql://postgres:postgrespassword@localhost:5432/pet_shelter?schema=public";

describe("resolveE2eDatabaseUrl", () => {
  it("drops a remote database", () => {
    expect(resolveE2eDatabaseUrl({ DATABASE_URL: REMOTE_URL })).toBe("");
  });

  it("keeps the local database the CI job provides", () => {
    expect(resolveE2eDatabaseUrl({ DATABASE_URL: CI_URL })).toBe(CI_URL);
  });

  it("leaves no database as no database", () => {
    expect(resolveE2eDatabaseUrl({})).toBe("");
    expect(resolveE2eDatabaseUrl({ DATABASE_URL: "" })).toBe("");
  });

  it("drops a URL it cannot read, rather than guessing it is local", () => {
    expect(resolveE2eDatabaseUrl({ DATABASE_URL: "not a url" })).toBe("");
  });

  it("keeps a remote database only for an explicit opt-in", () => {
    expect(resolveE2eDatabaseUrl({ DATABASE_URL: REMOTE_URL, E2E_ALLOW_REMOTE_DATABASE: "true" })).toBe(REMOTE_URL);
    expect(resolveE2eDatabaseUrl({ DATABASE_URL: REMOTE_URL, E2E_ALLOW_REMOTE_DATABASE: "1" })).toBe("");
  });
});

describe("playwright.config.ts web server", () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    restoreEnv = snapshotProcessEnv();
    for (const key of ["DATABASE_URL", "RESEND_API_KEY", "E2E_ALLOW_REMOTE_DATABASE", "CI"]) {
      delete process.env[key];
    }
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnv();
  });

  /**
   * Imports the real config from a throwaway directory holding only `envLocal` as `.env.local`.
   * The config reads `.env.local` from the cwd, so without the move this would load the
   * repository's own — hosted credentials — into the test process.
   */
  async function loadConfig(envLocal: string) {
    const dir = mkdtempSync(join(tmpdir(), "e2e-config-"));
    const previousCwd = process.cwd();
    writeFileSync(join(dir, ".env.local"), envLocal, "utf8");
    process.chdir(dir);
    try {
      const config = (await import("../../playwright.config")).default;
      return config.webServer as { env?: Record<string, string>; reuseExistingServer?: boolean };
    } finally {
      process.chdir(previousCwd);
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("starts the server with no database and no mail key when .env.local names a remote database", async () => {
    const webServer = await loadConfig(`DATABASE_URL=${REMOTE_URL}\nRESEND_API_KEY=re_fake_not_a_real_key\n`);

    expect(webServer.env).toEqual({ DATABASE_URL: "", RESEND_API_KEY: "" });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("E2E_ALLOW_REMOTE_DATABASE"));
  });

  it("fails in CI rather than quietly running a database job without its database", async () => {
    process.env.CI = "true";
    process.env.DATABASE_URL = REMOTE_URL;

    await expect(loadConfig("")).rejects.toThrow(/not a local database/);
  });

  it("hands CI's local database to the server unchanged", async () => {
    process.env.CI = "true";
    process.env.DATABASE_URL = CI_URL;

    const webServer = await loadConfig("");

    expect(webServer.env?.DATABASE_URL).toBe(CI_URL);
    expect(webServer.env?.RESEND_API_KEY).toBe("");
  });

  it("never attaches to a server that is already running, whose environment it cannot set", async () => {
    const webServer = await loadConfig("");

    expect(webServer.reuseExistingServer).toBe(false);
  });
});
