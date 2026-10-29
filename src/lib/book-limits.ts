// Атомарное списание лимитов книги (переписать текст, перерисовка, смена настроения).
// Каждое списание — один условный UPDATE: «уменьшить, только если ещё есть». Параллельные запросы
// не уводят счётчик в минус и не ставят в очередь лишнюю работу: в очередь — только если count = 1.
import type { PrismaClient } from "@prisma/client";
import { db } from "./db";

type Client = Pick<PrismaClient, "book">;

/** Переписать текст: rewritesLeft > 0 и текст готов. */
export async function takeRewrite(id: string, client: Client = db) {
  const r = await client.book.updateMany({
    where: { id, rewritesLeft: { gt: 0 }, status: { in: ["TEXT_READY", "TEXT_APPROVED"] } },
    data: { rewritesLeft: { decrement: 1 }, status: "TEXT_QUEUED", progress: 0 },
  });
  return r.count === 1;
}

/** Платная книга: одна бесплатная перерисовка (redrawsLeft > 0). */
export async function takeRedraw(id: string, client: Client = db) {
  const r = await client.book.updateMany({ where: { id, paidFull: true, redrawsLeft: { gt: 0 } }, data: { redrawsLeft: { decrement: 1 } } });
  return r.count === 1;
}

/** Смена настроения до оплаты: не больше limit раз, только когда превью готово. */
export async function takePreviewMood(id: string, mood: string | null, limit: number, client: Client = db) {
  const r = await client.book.updateMany({
    where: { id, paidFull: false, status: "PREVIEW_READY", moodChangesPreview: { lt: limit } },
    data: { mood, moodChangesPreview: { increment: 1 }, status: "PREVIEW_QUEUED", progress: 0 },
  });
  return r.count === 1;
}

/** Смена настроения после оплаты: первая — бесплатно, дальше — одна перерисовка из лимита. */
export async function takeFullMood(id: string, mood: string | null, free: boolean, client: Client = db) {
  const r = await client.book.updateMany({
    where: free
      ? { id, paidFull: true, status: "FULL_READY", moodChangesFull: 0 }
      : { id, paidFull: true, status: "FULL_READY", moodChangesFull: { gt: 0 }, redrawsLeft: { gt: 0 } },
    data: { mood, moodChangesFull: { increment: 1 }, ...(free ? {} : { redrawsLeft: { decrement: 1 } }), status: "FULL_QUEUED", progress: 0 },
  });
  return r.count === 1;
}
