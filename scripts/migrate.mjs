// Применяет prisma/migrations/*/migration.sql по порядку.
// Ведёт таблицу _prisma_migrations в формате Prisma, поэтому совместим с `prisma migrate deploy`.
// Работает без бинарных движков Prisma: node scripts/migrate.mjs
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не задан");
  process.exit(1);
}
const dir = "prisma/migrations";
const client = new pg.Client({ connectionString: url });
await client.connect();

await client.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) PRIMARY KEY NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
)`);

// Блокировка, чтобы два контейнера не применяли миграции одновременно
await client.query("SELECT pg_advisory_lock(72707369)");
try {
  const applied = new Set(
    (await client.query(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`)).rows.map(
      (r) => r.migration_name,
    ),
  );
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "migration.sql")))
    .map((d) => d.name)
    .sort();
  let count = 0;
  for (const name of names) {
    if (applied.has(name)) continue;
    const sql = readFileSync(join(dir, name, "migration.sql"), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const id = randomUUID();
    await client.query("BEGIN");
    try {
      await client.query(`INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at) VALUES ($1,$2,$3,now())`, [id, checksum, name]);
      await client.query(sql);
      await client.query(`UPDATE "_prisma_migrations" SET finished_at = now(), applied_steps_count = 1 WHERE id = $1`, [id]);
      await client.query("COMMIT");
      console.log(`применена: ${name}`);
      count++;
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(`ошибка в ${name}: ${e.message}`);
      process.exitCode = 1;
      break;
    }
  }
  if (count === 0 && !process.exitCode) console.log("миграции: новых нет");
} finally {
  await client.query("SELECT pg_advisory_unlock(72707369)");
  await client.end();
}
