import PgBoss from "pg-boss";

// Очередь задач на PostgreSQL (pg-boss): генерация, PDF, уведомления,
// удаление фото, бэкапы, триггеры. Отдельный Redis не нужен.
export const QUEUES = {
  generatePreview: "generate-preview",
  generateFull: "generate-full",
  renderPdf: "render-pdf",
  tts: "tts",
  notify: "notify",
  purgePhotos: "purge-photos",
  cancelUnpaid: "cancel-unpaid",
  triggers: "triggers",
  referralBonuses: "referral-bonuses",
  npdLimitCheck: "npd-limit-check",
  gpuIdleShutdown: "gpu-idle-shutdown",
} as const;

let boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL не задан");
  boss = new PgBoss({ connectionString: process.env.DATABASE_URL, schema: "pgboss" });
  boss.on("error", (e) => console.error("[pg-boss]", e));
  await boss.start();
  for (const q of Object.values(QUEUES)) await boss.createQueue(q);
  return boss;
}
