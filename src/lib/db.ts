import "server-only";
import { PrismaClient } from "@prisma/client";

export const hasDatabase = Boolean(process.env.DATABASE_URL);

const g = globalThis as unknown as { prisma?: PrismaClient };

// Без DATABASE_URL (сборка, предпросмотр) клиент не создаётся, а каталог
// берётся из значений по умолчанию — каждое обращение к db защищено hasDatabase.
export const db: PrismaClient = hasDatabase
  ? (g.prisma ??= new PrismaClient())
  : (null as unknown as PrismaClient);
