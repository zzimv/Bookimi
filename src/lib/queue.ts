import PgBoss from "pg-boss";

// Очередь задач на PostgreSQL (pg-boss): генерация, PDF, уведомления, удаление фото,
// автоотмена заказов, триггеры, бонусы, проверки лимитов, управление GPU. Redis не нужен.
export const QUEUES = {
  generateText: "generate-text",
  generatePreview: "generate-preview",
  generateFull: "generate-full",
  redraw: "redraw",
  mood: "mood",
  audio: "audio",
  purgePhotos: "purge-photos",
  cancelUnpaid: "cancel-unpaid",
  triggers: "triggers",
  referralBonuses: "referral-bonuses",
  npdLimitCheck: "npd-limit-check",
  gpuTick: "gpu-tick",
  generateCartoon: "generate-cartoon",
  purgeCartoonVoices: "purge-cartoon-voices",
  /** Повтор уведомлений, которые не ушли сразу (SMTP/Telegram недоступны): с нарастающей паузой. */
  sendNotification: "send-notification",
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

/** Минимальный интерфейс транзакции Prisma для постановки задачи в той же транзакции. */
type RawTx = { $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T> };

/**
 * Поставить задачу в той же транзакции БД, что и изменение данных (outbox): откат транзакции — задачи нет,
 * коммит — задача точно в очереди. pg-boss пишет в свою таблицу через переданное соединение.
 */
export async function enqueueInTx(tx: RawTx, queue: (typeof QUEUES)[keyof typeof QUEUES], data: object, opts: PgBoss.SendOptions = {}) {
  const boss = await getBoss();
  const wrapper = {
    executeSql: async (text: string, values: unknown[] = []) => ({
      rows: await tx.$queryRawUnsafe<unknown[]>(
        text,
        ...values.map((v) => (v === undefined ? null : v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v)),
      ),
    }),
  };
  return boss.send(queue, data, { retryLimit: 2, retryDelay: 30, ...opts, db: wrapper } as PgBoss.SendOptions);
}
