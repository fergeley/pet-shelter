/**
 * Applies the community bulletin migration and seeds `src/data/bulletins.json` into it.
 *
 * Separate from `prisma/seed.ts` for the reason `migrate-faqs.ts` gives: that
 * script is refused against anything but a local database
 * (`assertSeedTargetIsLocal`), because it is not additive — it deletes and
 * rewrites pets, applications and staff users from fixtures. This one only ever
 * touches the `bulletins` table, so it is safe to point at a hosted branch,
 * which is what makes the launch notices deployable without a full reseed.
 *
 * It is ALSO the only safe way to put this table on the production branch.
 * `npm run db:push` reconciles the whole schema, and
 * `tasks/open/production-schema-has-drifted-ahead-of-master.md` records three
 * destructive statements currently standing between master's schema and that
 * database — two of which lose data and have nothing to do with bulletins.
 *
 * `DATABASE_URL` is resolved through `prisma/env.ts`, the single resolver every
 * database-touching script shares, so this cannot end up talking to a different
 * database than `db:push` or `db:check-drift`.
 *
 * Prints the table list before and after so the blast radius is visible.
 */
import fs from "node:fs";
import { Pool } from "pg";

import { resolveDatabaseUrl, LOCAL_DATABASE_URL } from "../prisma/env";
import { resolveDatabaseSsl } from "../src/lib/server/databaseSsl";
import bulletinsData from "../src/data/bulletins.json";

const MIGRATION = "prisma/migrations/manual/20260922_community_bulletins/migration.sql";

async function main() {
  const connectionString = resolveDatabaseUrl();
  const sslPolicy = resolveDatabaseSsl(connectionString);

  console.log(
    "Target:",
    connectionString.replace(/:\/\/([^:]+):[^@]+@/, "://$1:***@"),
    connectionString === LOCAL_DATABASE_URL ? "(local)" : "(remote)"
  );

  const pool = new Pool({
    connectionString: sslPolicy.connectionString,
    ssl: sslPolicy.ssl,
    connectionTimeoutMillis: 20000,
  });

  const listTables = async () => {
    const r = await pool.query(
      "select table_name from information_schema.tables where table_schema='public' order by 1"
    );
    return r.rows.map((x: { table_name: string }) => x.table_name);
  };

  try {
    const before = await listTables();
    console.log("Tables before:", before.join(", ") || "(none)");

    // The file carries its own BEGIN/COMMIT and takes an advisory lock, so if
    // another worktree is mid-migration this blocks rather than racing.
    await pool.query(fs.readFileSync(MIGRATION, "utf8"));
    console.log("Migration    : applied and committed");

    const after = await listTables();
    const added = after.filter((t) => !before.includes(t));
    const removed = before.filter((t) => !after.includes(t));
    console.log("Added        :", added.join(", ") || "(none)");
    console.log("Removed      :", removed.join(", ") || "(none)");

    for (const bulletin of bulletinsData) {
      // `isPinned` and `isPublished` are INSERT-only, not part of the DO UPDATE
      // set: re-running this must not republish or re-pin a notice that staff
      // have deliberately taken down. Same contract as the FAQ seeder and
      // prisma/seed.ts.
      await pool.query(
        `INSERT INTO "bulletins"
           ("id","category","targetPage","title","content","titleMs","contentMs",
            "mediaType","mediaUrl","videoEmbedUrl","isPinned","isPublished",
            "authorName","publishedAt","updatedAt")
         VALUES ($1, $2::"BulletinCategory", $3::"BulletinTargetPage", $4, $5, $6, $7,
                 $8::"BulletinMediaType", $9, $10, $11, $12, $13, $14::date, NOW())
         ON CONFLICT ("id") DO UPDATE SET
           "category"      = EXCLUDED."category",
           "targetPage"    = EXCLUDED."targetPage",
           "title"         = EXCLUDED."title",
           "content"       = EXCLUDED."content",
           "titleMs"       = EXCLUDED."titleMs",
           "contentMs"     = EXCLUDED."contentMs",
           "mediaType"     = EXCLUDED."mediaType",
           "mediaUrl"      = EXCLUDED."mediaUrl",
           "videoEmbedUrl" = EXCLUDED."videoEmbedUrl",
           "authorName"    = EXCLUDED."authorName",
           "publishedAt"   = EXCLUDED."publishedAt",
           "updatedAt"     = NOW()`,
        [
          bulletin.id,
          bulletin.category,
          bulletin.targetPage,
          bulletin.title,
          bulletin.content,
          bulletin.titleMs,
          bulletin.contentMs,
          bulletin.mediaType,
          bulletin.mediaUrl,
          bulletin.videoEmbedUrl,
          bulletin.isPinned,
          bulletin.isPublished,
          bulletin.authorName,
          bulletin.publishedAt,
        ]
      );
    }

    const counts = await pool.query(
      'select category, count(*)::int n from "bulletins" group by category order by category'
    );
    const total = await pool.query('select count(*)::int n from "bulletins"');
    console.log(
      `Seeded       : ${bulletinsData.length} notices, ${total.rows[0].n} rows total`
    );
    for (const row of counts.rows as { category: string; n: number }[]) {
      console.log(`  ${row.category.padEnd(14)} ${row.n}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Bulletin migration failed:", e);
  process.exit(1);
});
