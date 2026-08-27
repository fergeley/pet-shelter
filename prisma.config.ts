import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./prisma/env";

/**
 * Env loading and the localhost fallback both live in `prisma/env.ts` so that the
 * Prisma CLI and `prisma/seed.ts` cannot resolve different databases — see the
 * module comment there for the bug that made this necessary.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
