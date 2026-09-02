/**
 * Reports how far the live database has drifted from prisma/schema.prisma, and
 * in particular what `prisma db push` would DESTROY if anyone ran it.
 *
 * This project has no `_prisma_migrations` ledger — it uses a `db push`
 * workflow — so nothing records which hand-written migrations have been
 * applied. With several worktrees each holding a different subset of the schema
 * on their own branch, that missing ledger is the whole problem: there is no
 * shared answer to "what is actually in the database right now?".
 *
 * Rather than re-implementing a schema comparison, this asks Prisma for the
 * exact SQL it would run to make the database match the schema file:
 *
 *   prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
 *
 * Anything destructive in that output is something the database has and this
 * branch's schema does not — i.e. another branch's work, or a table nobody has
 * modelled yet.
 *
 * Exit codes: 0 clean or additive-only, 1 destructive drift, 2 could not run.
 */
import "dotenv/config";
import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. A fresh worktree has no .env.local (it is gitignored),\n" +
      "so copy one in before running this:  cp ../../../.env.local .env.local"
  );
  process.exit(2);
}

// Run Prisma's JS entrypoint through the current node binary rather than the
// `npx`/`prisma` shim: Windows refuses to spawn a .cmd without a shell, and
// using a shell would mean quoting paths. createRequire resolves the CLI from
// this worktree's own node_modules.
const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");

const result = spawnSync(
  process.execPath,
  [
    prismaCli,
    "migrate",
    "diff",
    "--from-config-datasource",
    "--to-schema",
    "prisma/schema.prisma",
    "--script",
  ],
  { encoding: "utf8" }
);

if (result.status !== 0) {
  console.error("prisma migrate diff failed:\n", result.stderr || result.stdout);
  process.exit(2);
}

// Strip Prisma's banner lines so only SQL remains.
const sql = result.stdout
  .split("\n")
  .filter((l) => !/^\s*(◇|Loaded Prisma config|Prisma schema loaded|Environment variables)/.test(l))
  .join("\n")
  .trim();

// Prisma labels every statement with a leading `-- DropTable` style comment, so
// comments must be stripped from INSIDE each chunk. Discarding any chunk that
// merely starts with "--" silently drops every statement and reports a clean
// database — a false negative, which is the one result this tool must never
// produce.
const statements = sql
  .split(";")
  .map((chunk) =>
    chunk
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n")
      .trim()
  )
  .filter(Boolean);

const DESTRUCTIVE = /^\s*(DROP\s+(TABLE|TYPE|INDEX|SCHEMA)|ALTER\s+TABLE\s+.*\bDROP\s+(COLUMN|CONSTRAINT)\b)/is;
const destructive = statements.filter((s) => DESTRUCTIVE.test(s));
const additive = statements.filter((s) => !DESTRUCTIVE.test(s));

console.log("=".repeat(72));
console.log("Drift: live database  vs  prisma/schema.prisma");
console.log("=".repeat(72));

if (statements.length === 0) {
  console.log("\nNo drift. The database matches this branch's schema exactly.");
  console.log("`prisma db push` would be a no-op.\n");
  process.exit(0);
}

if (destructive.length > 0) {
  console.log(
    `\n!! ${destructive.length} DESTRUCTIVE statement(s). \`prisma db push\` WOULD DESTROY DATA:\n`
  );
  for (const s of destructive) {
    console.log("   " + s.replace(/\s+/g, " ").slice(0, 160));
  }
  console.log(
    "\n   These objects exist in the database but not in this branch's schema.\n" +
      "   They usually belong to another worktree's branch. Do NOT run `db push`.\n" +
      "   Add tables/columns with additive SQL instead — see\n" +
      "   prisma/migrations/manual/ for the shape."
  );
}

if (additive.length > 0) {
  console.log(
    `\n${additive.length} additive statement(s) — things this branch's schema has that the database lacks:\n`
  );
  for (const s of additive) {
    console.log("   " + s.replace(/\s+/g, " ").slice(0, 160));
  }
  console.log("\n   These are safe to apply. If they are yours, they are not migrated yet.");
}

console.log("");
process.exit(destructive.length > 0 ? 1 : 0);
