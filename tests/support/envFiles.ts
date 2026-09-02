import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Env-file fixtures for `prisma/env.ts`.
 *
 * `loadDatabaseEnv()` passes dotenv the *relative* paths ".env.local" and ".env",
 * which dotenv hands straight to `fs.readFileSync`. There is no path parameter,
 * no injectable loader, and no `processEnv` override — so the only lever a test
 * has over which files that function sees is the real process working directory.
 *
 * Two consequences worth knowing before reusing this:
 *
 *  1. The repo root holds a real `.env.local` pointing at a hosted Neon branch.
 *     Calling `resolveDatabaseUrl()` from the default cwd loads those production
 *     credentials into the test process. Every test of that function must run
 *     inside a fixture directory, and that is a safety requirement rather than a
 *     tidiness one.
 *  2. `process.chdir()` throws inside a worker thread. This fixture works only
 *     under Vitest's `forks` pool (the default in 4.x). Moving the unit project
 *     to `pool: "threads"` breaks these suites — with an explicit throw rather
 *     than a silent pass, which is why the chdir is not guarded.
 */

/** File name -> literal file contents. Omit a key to leave that file absent. */
export type EnvFileSet = Partial<Record<".env.local" | ".env", string>>;

/**
 * Runs `run()` with the process cwd pointed at a throwaway directory containing
 * exactly `files` — nothing else. Restores the cwd and removes the directory
 * even when `run()` throws.
 */
export function withEnvFiles<T>(files: EnvFileSet, run: () => T): T {
  const dir = mkdtempSync(join(tmpdir(), "prisma-env-"));
  const previousCwd = process.cwd();

  try {
    for (const [name, contents] of Object.entries(files)) {
      writeFileSync(join(dir, name), contents, "utf8");
    }
    process.chdir(dir);
    return run();
  } finally {
    process.chdir(previousCwd);
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Snapshots `process.env` and returns the restore function.
 *
 * `resolveDatabaseUrl()` does not return a value so much as mutate the process:
 * dotenv writes every key of every file it reads into `process.env`, and those
 * keys survive into the next test in the file. Without this, test two reads
 * test one's fixture and the precedence assertions all pass for the wrong reason.
 */
export function snapshotProcessEnv(): () => void {
  const saved = { ...process.env };

  return () => {
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) delete process.env[key];
    }
    Object.assign(process.env, saved);
  };
}
