// Локальная PostgreSQL 16 без Docker — для разработки и демонстрации.
// npm run db:local  → postgresql://bookimi:bookimi@localhost:5433/bookimi
// В продакшне используется контейнер db из docker-compose.yml.
import EmbeddedPostgres from "embedded-postgres";

const dir = process.env.PGDATA_DIR ?? "/tmp/bk-pg";
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "bookimi",
  password: "bookimi",
  port: Number(process.env.PGPORT ?? 5433),
  persistent: true,
  onLog: () => {},
});

try {
  await pg.initialise();
} catch {
  /* каталог уже инициализирован */
}
await pg.start();
await pg.createDatabase("bookimi").catch(() => {});
console.log("PG UP: postgresql://bookimi:bookimi@localhost:5433/bookimi");
process.on("SIGINT", async () => {
  await pg.stop();
  process.exit(0);
});
setInterval(() => {}, 1 << 30);
