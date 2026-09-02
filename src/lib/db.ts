import { PrismaClient } from "@prisma/client";

// Client Prisma partagé (évite d'ouvrir trop de connexions en développement,
// à cause du rechargement à chaud de Next.js).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
