import { PrismaClient } from "@prisma/client";

// Single shared client. In dev, Next's module reloading would otherwise leak
// connections, so we stash it on globalThis.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.LOG_LEVEL === "debug" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Apply SQLite pragmas that matter for the single-writer import workload. */
export async function applySqlitePragmas() {
  if (!process.env.DATABASE_URL?.startsWith("file:")) return;
  // several PRAGMA statements return a row, so route them all through $queryRaw*
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
  await prisma.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
}
