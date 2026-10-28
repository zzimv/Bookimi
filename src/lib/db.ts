import type { PrismaClient } from "@prisma/client";
import { createPrisma } from "./prisma-client";

export const hasDatabase = Boolean(process.env.DATABASE_URL);

const g = globalThis as unknown as { prisma?: PrismaClient };

// Без DATABASE_URL (сборка образа) клиент не создаётся, каталог берётся из значений по умолчанию.
export const db: PrismaClient = hasDatabase ? (g.prisma ??= createPrisma()) : (null as unknown as PrismaClient);
