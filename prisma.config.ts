// Prisma без бинарных движков: запросы — через WASM-компилятор и драйвер pg,
// миграции — через JS-движок схемы. Образ меньше, ничего не скачивается при сборке.
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

export default defineConfig({
  experimental: { adapter: true },
  engine: "js",
  schema: "prisma/schema.prisma",
  migrations: { seed: "tsx prisma/seed.ts" },
  async adapter() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL не задан");
    return new PrismaPg({ connectionString: url });
  },
});
