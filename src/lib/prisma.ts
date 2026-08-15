import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgrespassword@localhost:5432/pet_shelter?schema=public";

  try {
    const isSsl = connectionString.includes("sslmode=require") || connectionString.includes("neon.tech");
    
    // Reuse connection pool across Turbopack hot reloads in dev mode
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
    if (process.env.NODE_ENV === "development") {
      console.warn("[Prisma] Pool initialization fallback:", err);
    }
    return new PrismaClient({
      log: process.env.PRISMA_LOG === "true" ? ["error", "warn"] : [],
    });
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
