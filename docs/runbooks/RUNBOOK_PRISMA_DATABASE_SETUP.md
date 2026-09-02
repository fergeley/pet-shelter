# Runbook: Resolving Production Database Schema & Prisma Fallback Errors

**Hope for Strays — Animal Shelter & Adoption Platform**  
*Service Component: Database Layer / Prisma ORM / PostgreSQL / Neon*  
*Severity: High | Operational Guide*

---

## 1. Problem Statement & Symptoms

### Symptom
During runtime execution (especially in production environments such as Vercel, Railway, Render, or Docker containers), server logs emit the following warning:

```text
[Database Store] Prisma applications query falling back to memory store: 
Invalid `prisma.adoptionApplication.findMany()` invocation:
Error: Table "public.adoption_applications" does not exist in the current database.
```
or
```text
[Database Store] Prisma pet query falling back to memory store:
Invalid `prisma.pet.findMany()` invocation:
```

### Impact
- Application queries fall back to the built-in memory store (`src/lib/serverStore.ts`), which holds initial seed records in RAM.
- Any newly submitted adoption applications, updated statuses, or modified pet profiles are **not persisted** to PostgreSQL and will be wiped upon the next serverless instance reboot or cold start.

---

## 2. Root Cause Analysis

| Factor | Description |
| :--- | :--- |
| **Missing DB Tables in Remote Database** | While local development or test suites may use local Postgres or memory stores, the remote production database (e.g. Neon, AWS RDS, Supabase) has not had the Prisma schema pushed or migrated yet. |
| **Missing / Improper `DATABASE_URL`** | The production hosting provider does not have `DATABASE_URL` configured in its environment variables, or the URL lacks the mandatory `?sslmode=require` / `channel_binding` flags. |
| **Prisma Client Drift** | The generated `@prisma/client` artifact in `node_modules` expects models/columns that differ from the remote database schema. |
| **Connection Pooling / Adapter Error** | The connection pool in [`src/lib/prisma.ts`](file:///c:/Users/User/pet-shelter/src/lib/prisma.ts) could not connect due to connection limit exhaustion, invalid credentials, or cold start timeouts. |

---

## 3. Step-by-Step Resolution Procedures

### Procedure A: Push Schema to Remote / Production Database

> **DANGER — `prisma db push` is destructive when the database has drifted.**
>
> `db push` reconciles the database *to* `schema.prisma`. Anything live that the
> schema file does not declare is **dropped**, including populated tables. This is
> not hypothetical here: on 2026-09-02, `npx prisma db pull --print` showed
> production carrying `Pet.rehabProgressPercent`, `Pet.rehabStage`,
> `Pet.rehabStageMs` and the whole `medical_timeline_events` and `pet_updates`
> tables, none of which are declared in `prisma/schema.prisma` — they belong to a
> branch that has not landed. A `db push` from `master` would have deleted all of
> them.
>
> **Always run `npx prisma db pull --print` first and diff it against
> `prisma/schema.prisma`.** If anything in the database is missing from the file,
> use Procedure A2 instead.

Use `db push` only against a scratch or branch database you are willing to lose,
or when a fresh `db pull` confirms the schema file is a superset of what is live.

#### Option 1: Direct CLI Command (Manual Fix)
```bash
# Export the production DATABASE_URL (replace with your actual credentials)
export DATABASE_URL="postgresql://<user>:<password>@<neon-or-pg-host>/<database>?sslmode=require"

# Push schema directly to the database
npx prisma db push
```

*On Windows PowerShell:*
```powershell
$env:DATABASE_URL="postgresql://<user>:<password>@<neon-or-pg-host>/<database>?sslmode=require"
npx prisma db push
```

#### Option 2: Run via NPM Script
If `DATABASE_URL` is configured in your `.env.local` or environment:
```bash
npm run db:push
```

Expected Output:
```text
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "neondb", schema "public" at "ep-xxxx.ap-southeast-1.aws.neon.tech"

Applying the following changes to database:
  - CreateTable "users"
  - CreateTable "pets"
  - CreateTable "adoption_applications"
  - CreateTable "audit_logs"
  - CreateTable "shelter_settings"

🚀 Your database is now in sync with your Prisma schema. Done in 1.45s
```

---

### Procedure A2: Apply an Additive Migration by Hand (Safe Default)

Adding nullable, default-free columns is a catalog-only change in PostgreSQL: no
table rewrite, no row lock, and invisible to code that predates them. That last
property is what makes it safe to run *before* the code merges.

1. Write the statements to a re-runnable file under `prisma/sql/`:

```sql
-- prisma/sql/YYYY-MM-DD-<change>.sql
ALTER TABLE "shelter_settings" ADD COLUMN IF NOT EXISTS "duitNowQrUrl" TEXT;
ALTER TABLE "pets"             ADD COLUMN IF NOT EXISTS "customQrUrl"  TEXT;

-- Rollback:
-- ALTER TABLE "shelter_settings" DROP COLUMN IF EXISTS "duitNowQrUrl";
-- ALTER TABLE "pets"             DROP COLUMN IF EXISTS "customQrUrl";
```

2. Apply it:

```bash
npx prisma db execute --file prisma/sql/YYYY-MM-DD-<change>.sql
```

Prisma 7 removed `--schema` from `db execute`; it errors with "unknown or
unexpected option". The datasource URL comes from `prisma.config.ts`, which loads
`.env.local`.

3. Verify with `npx prisma db pull --print` — confirm the new columns exist **and**
   that nothing else disappeared.

#### Run the migration before merging the code, not after

Prisma selects every column its generated client declares. Between merging a
schema change and applying it, ordinary reads fail:

```
prisma.pet.findMany() -> The column `pets.customQrUrl` does not exist
```

This codebase catches those errors and falls back to in-memory seed data, so the
site keeps rendering while silently serving `src/data/pets.json` instead of real
records — and `insertServerPet` / `updateServerPet` catch it too and only
`console.warn`, so writes appear to succeed and persist nothing. Because additive
columns are invisible to the older code, migrating first has no downside and
removes the window entirely.

### Procedure B: Seed Production Database with Initial Data

Once tables are created, populate default admin credentials, sample pet inventory, and initial shelter settings:

```bash
# Using tsx to execute seed script against production DB
DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require" npx tsx prisma/seed.ts
```

*On Windows PowerShell:*
```powershell
$env:DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"
npm run db:seed
```

Expected Output:
```text
🌱 Starting database seeding...
🧹 Cleaning up existing records...
👥 Creating initial administrative staff users...
  - Created Super Admin: admin@hopeforstrays.org
  - Created Coordinator: coordinator@hopeforstrays.org
  - Created Staff: staff@hopeforstrays.org
🐾 Creating sample pet inventory (8 animals)...
  - Created pet: Milo (Dog - Male)
  - Created pet: Luna (Cat - Female)
  ...
📋 Creating sample adoption applications...
  - Created application for Milo from Sarah Jenkins
🏢 Creating default shelter configuration...
✨ Database seeding completed successfully!
```

---

### Procedure C: Configure Production Hosting Environment Variables

In your deployment dashboard (e.g. **Vercel Project Settings $\rightarrow$ Environment Variables**, **Railway Variables**, **Render Environment**):

1. Set `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://<user>:<password>@<neon-or-pg-host>/<database>?sslmode=require"
   ```
2. For Neon databases using connection pooling:
   - Use the **Pooled connection string** (port 5432 with `-pooler` endpoint) for runtime queries.
   - Use the **Direct/Unpooled connection string** if running migrations.
3. Ensure the Build Script runs `prisma generate`:
   [`package.json`](file:///c:/Users/User/pet-shelter/package.json) is already preconfigured with:
   ```json
   "build": "prisma generate && next build"
   ```

---

### Procedure D: Verify Connection Pool Configuration

Check [`src/lib/prisma.ts`](file:///c:/Users/User/pet-shelter/src/lib/prisma.ts#L10-L46):

```typescript
function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgrespassword@localhost:5432/pet_shelter?schema=public";

  try {
    const isSsl = connectionString.includes("sslmode=require") || connectionString.includes("neon.tech");
    
    const pool =
      globalForPrisma.pgPool ??
      new Pool({
        connectionString,
        ssl: isSsl ? { rejectUnauthorized: false } : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.pgPool = pool;
    }

    const adapter = new PrismaPg(pool);
    return new PrismaClient({
      adapter,
      log: process.env.PRISMA_LOG === "true" ? ["error", "warn"] : [],
    });
  } catch (err) {
    ...
  }
}
```

> [!TIP]
> When connecting to Neon Serverless PostgreSQL, ensure that SSL is enabled. The `rejectUnauthorized: false` configuration in `src/lib/prisma.ts` handles Neon certificate handshakes automatically.

---

## 4. Verification & Health Checks

### Verification Command
Run a quick Node.js / tsx probe to confirm table presence:

```bash
npx tsx -e '
import { prisma } from "./src/lib/prisma";
async function verify() {
  const count = await prisma.adoptionApplication.count();
  console.log("✅ Successfully queried adoption_applications. Record count:", count);
  await prisma.$disconnect();
}
verify().catch((e) => { console.error("❌ Query failed:", e); process.exit(1); });
'
```

### Admin Portal Live Verification
1. Navigate to `/admin/applications` in your production deployment.
2. Verify that the table renders live records without displaying any fallback warnings in your server log output.
3. Submit a new test application from `/pets/[id]/apply`.
4. Refresh the admin dashboard and confirm the application appears immediately.

---

## 5. Rollback & Disaster Recovery

If schema push introduces unintended column types or conflicts:
1. Review [`prisma/schema.prisma`](file:///c:/Users/User/pet-shelter/prisma/schema.prisma) against git history.
2. Re-run `npx prisma db push --force-reset` on your staging / non-production environment, or alter table columns using standard SQL scripts if preserving live production data.
