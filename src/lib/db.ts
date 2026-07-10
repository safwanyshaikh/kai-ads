import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 * In dev, Next.js hot-reloads modules which would otherwise create a new
 * PrismaClient (and a new DB connection pool) on every save. We stash the
 * instance on `globalThis` to survive reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
