// Единая фабрика PrismaClient: драйвер pg + WASM-компилятор запросов (без бинарных движков).
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export function createPrisma(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL не задан");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 10 }) });
}
