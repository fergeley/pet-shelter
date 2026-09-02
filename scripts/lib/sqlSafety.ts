/**
 * Classifies a migration statement as destructive or additive.
 *
 * Separate from `scripts/check-drift.ts` so it can be unit-tested. This is a
 * safety tool whose only unacceptable output is a false negative — telling an
 * operator that a `db push` which drops production tables is "safe to apply" —
 * so the classification rules need regression coverage, not just a careful
 * read. Both failures below have actually occurred; see
 * `tests/unit/sqlSafety.test.ts`.
 */

/**
 * Dropping objects is the obvious case, but an in-place column change is just
 * as destructive and contains no DROP: `SET DATA TYPE` rewrites or rejects
 * every value, `SET NOT NULL` fails outright if any row is null, `DROP DEFAULT`
 * changes what later inserts store, and RENAME breaks every reader of the old
 * name.
 */
export const DESTRUCTIVE_PATTERNS: readonly RegExp[] = [
  /\bDROP\s+(TABLE|TYPE|INDEX|SCHEMA|VIEW|SEQUENCE)\b/i,
  /\bDROP\s+(COLUMN|CONSTRAINT)\b/i,
  /\bALTER\s+COLUMN\b[\s\S]*?\bSET\s+DATA\s+TYPE\b/i,
  /\bALTER\s+COLUMN\b[\s\S]*?\bTYPE\b/i,
  /\bALTER\s+COLUMN\b[\s\S]*?\bSET\s+NOT\s+NULL\b/i,
  /\bALTER\s+COLUMN\b[\s\S]*?\bDROP\s+DEFAULT\b/i,
  /\bTRUNCATE\b/i,
  /\bRENAME\s+(TO|COLUMN)\b/i,
];

export function isDestructiveStatement(statement: string): boolean {
  return DESTRUCTIVE_PATTERNS.some((re) => re.test(statement));
}

/**
 * Splits a Prisma `migrate diff --script` dump into statements.
 *
 * Comments are stripped from INSIDE each chunk rather than by discarding chunks
 * that begin with "--". Prisma labels every statement with a leading
 * `-- DropTable` comment, so the naive filter drops every statement and reports
 * a clean database.
 */
export function parseStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter(Boolean);
}

/** Removes Prisma's banner/log lines so only SQL remains. */
export function stripBanner(stdout: string): string {
  return stdout
    .split("\n")
    .filter(
      (l) => !/^\s*(◇|Loaded Prisma config|Prisma schema loaded|Environment variables)/.test(l)
    )
    .join("\n")
    .trim();
}

export interface DiffClassification {
  statements: string[];
  destructive: string[];
  additive: string[];
}

export function classifyDiff(stdout: string): DiffClassification {
  const statements = parseStatements(stripBanner(stdout));
  return {
    statements,
    destructive: statements.filter(isDestructiveStatement),
    additive: statements.filter((s) => !isDestructiveStatement(s)),
  };
}
