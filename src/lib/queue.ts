import PgBoss from "pg-boss";

// Очередь задач на PostgreSQL (pg-boss): генерация, PDF, уведомления, удаление фото,
// автоотмена заказов, триггеры, бонусы, проверки лимитов, управление GPU. Redis не нужен.
export const QUEUES = {
  generateText: "generate-text",
  generatePreview: "generate-preview",
  generateFull: "generate-full",
  redraw: "redraw",
  audio: "audio",
  purgePhotos: "purge-photos",
  cancelUnpaid: "cancel-unpaid",
  triggers: "triggers",
  referralBonuses: "referral-bonuses",
  npdLimitCheck: "npd-limit-check",
  gpuTick: "gpu-tick",
} as const;

const g = globalThis as unknown as { boss?: Promise<PgBoss> };

export function getBoss(): Promise<PgBoss> {
  if (!g.boss) {
    g.boss = (async () => {
      if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL не задан");
      const boss = new PgBoss({ connectionString: process.env.DATABASE_URL, schema: "pgboss", max: 4 });
      boss.on("error", (e) => console.error("[pg-boss]", e.message));
      await boss.start();
      for (const q of Object.values(QUEUES)) await boss.createQueue(q);
      return boss;
    })();
  }
  return g.boss;
}

export async function enqueue(queue: (typeof QUEUES)[keyof typeof QUEUES], data: object, opts: PgBoss.SendOptions = {}) {
  const boss = await getBoss();
  return boss.send(queue, data, { retryLimit: 2, retryDelay: 30, ...opts });
}
