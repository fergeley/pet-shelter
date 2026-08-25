/**
 * Strict-persistence switch for the repository layer.
 *
 * The dual-layer store (docs/architecture/LAYERS.md, L-B2) deliberately swallows
 * Prisma errors and falls back to the in-memory JSON fixtures, so the app runs
 * with no database at all. That same forgiveness makes it impossible for an
 * integration test to tell a working query from a broken one: a schema drift, a
 * renamed column, or a malformed `where` clause all "pass" by silently serving
 * fixture data.
 *
 * Setting `STRICT_PERSISTENCE=true` disables the fallback and rethrows, so the
 * Tier-3 suite fails loudly on the real defect instead of green-lighting it.
 *
 * The flag is read on every call rather than captured at module load, so
 * `vi.stubEnv("STRICT_PERSISTENCE", ...)` works inside an already-imported module.
 */
export function isStrictPersistence(): boolean {
  return process.env.STRICT_PERSISTENCE === "true";
}

/**
 * How loudly a swallowed failure is reported when strict mode is *off*.
 *
 * The two levels mirror the pre-existing behaviour of the call sites, and the
 * difference is deliberate rather than an inconsistency to tidy away:
 *
 * - `"read"` — warn in development only. A read falling back offline is the
 *   documented, expected state of this app; warning on it in production would
 *   be pure noise.
 * - `"write"` — warn always. A write that reached only the in-memory array is
 *   data loss the moment the process restarts, so it stays visible in every
 *   environment.
 */
export type PersistenceFailureKind = "read" | "write";

/**
 * The single decision point every repository catch block delegates to.
 *
 * Strict mode rethrows the original error — preserving its stack and Prisma
 * error code — rather than wrapping it, because the wrapper would hide exactly
 * the detail the test needs. Non-strict mode leaves the caller to fall through
 * to its in-memory result.
 *
 * @param context Human-readable label for the failing operation, used in the warning.
 * @param err     The caught value, rethrown verbatim under strict mode.
 * @param kind    Reporting level for non-strict mode. See {@link PersistenceFailureKind}.
 */
export function handlePersistenceError(
  context: string,
  err: unknown,
  kind: PersistenceFailureKind = "read"
): void {
  if (isStrictPersistence()) {
    throw err;
  }
  if (kind === "write" || process.env.NODE_ENV === "development") {
    console.warn(
      `[Database Store] ${context} fallback notice:`,
      err instanceof Error ? err.message : err
    );
  }
}
