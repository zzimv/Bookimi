// Фоновый воркер (контейнер `worker`): генерация, PDF, аудио, регулярные задачи.
import { db } from "../lib/db";
import { getBoss, QUEUES } from "../lib/queue";
import { runText, runPreview, runFull, runRedraw, runAudio, runMood, LimitReached } from "../lib/gen/pipeline";
import { purgeExpiredPhotos } from "../lib/photos";
import { runTriggers } from "../lib/triggers";
import { issueDueBonuses } from "../lib/referral";
import { checkNpdLimit } from "../lib/orders";
import { gpuTick } from "../lib/gen/gpu";
import { alertOwner } from "../lib/notify";
import { runCartoon } from "../lib/gen/cartoon";
import { purgeCartoonVoices } from "../lib/cartoon";

type Job<T> = { id: string; data: T }[];

async function fail(bookId: string, e: unknown) {
  const msg = (e as Error).message ?? String(e);
  await db.book.update({ where: { id: bookId }, data: { status: "FAILED", error: msg.slice(0, 300) } }).catch(() => {});
}

async function main() {
  const boss = await getBoss();

  await boss.work<{ bookId: string }>(QUEUES.generateText, { batchSize: 2 }, async (jobs: Job<{ bookId: string }>) => {
    for (const j of jobs) {
      try {
        await runText(j.data.bookId);
      } catch (e) {
        if (e instanceof LimitReached) {
          // Лимит расходов: сказка ждёт в очереди и повторится через 15 минут
          await boss.send(QUEUES.generateText, j.data, { startAfter: 15 * 60, singletonKey: `text-${j.data.bookId}` });
          return;
        }
        await fail(j.data.bookId, e);
        throw e;
      }
    }
  });

  await boss.work<{ bookId: string }>(QUEUES.generatePreview, { batchSize: 1 }, async (jobs: Job<{ bookId: string }>) => {
    for (const j of jobs) {
      try {
        await runPreview(j.data.bookId);
      } catch (e) {
        if (e instanceof LimitReached) {
          // Лимит расходов: превью ждёт в очереди и повторится через 15 минут
          await boss.send(QUEUES.generatePreview, j.data, { startAfter: 15 * 60, singletonKey: `preview-${j.data.bookId}` });
          return;
        }
        await fail(j.data.bookId, e);
        throw e;
      }
    }
  });

  await boss.work<{ bookId: string; orderId?: string }>(QUEUES.generateFull, { batchSize: 1 }, async (jobs: Job<{ bookId: string; orderId?: string }>) => {
    for (const j of jobs) {
      try {
        await runFull(j.data.bookId, j.data.orderId);
      } catch (e) {
        await fail(j.data.bookId, e);
        await alertOwner("Ошибка генерации оплаченной книги", `Книга ${j.data.bookId}: ${(e as Error).message}`);
        throw e;
      }
    }
  });

  await boss.work<{ bookId: string; index: number }>(QUEUES.redraw, async (jobs: Job<{ bookId: string; index: number }>) => {
    for (const j of jobs) await runRedraw(j.data.bookId, j.data.index);
  });

  await boss.work<{ bookId: string }>(QUEUES.mood, { batchSize: 1 }, async (jobs: Job<{ bookId: string }>) => {
    for (const j of jobs) {
      try {
        await runMood(j.data.bookId);
      } catch (e) {
        await fail(j.data.bookId, e);
        throw e;
      }
    }
  });

  await boss.work<{ bookId: string }>(QUEUES.audio, async (jobs: Job<{ bookId: string }>) => {
    for (const j of jobs) await runAudio(j.data.bookId);
  });

  // Мультфильм: по одному за раз (CPU и память воркера), ошибка — владельцу и в карточку мультфильма
  await boss.work<{ bookId: string }>(QUEUES.generateCartoon, { batchSize: 1 }, async (jobs: Job<{ bookId: string }>) => {
    for (const j of jobs) await runCartoon(j.data.bookId);
  });

  // ── Регулярные задачи (время — МСК) ──
  const tz = { tz: "Europe/Moscow" };
  await boss.schedule(QUEUES.purgePhotos, "*/30 * * * *", {}, tz);
  await boss.schedule(QUEUES.cancelUnpaid, "*/5 * * * *", {}, tz);
  await boss.schedule(QUEUES.triggers, "*/10 * * * *", {}, tz);
  await boss.schedule(QUEUES.referralBonuses, "15 * * * *", {}, tz);
  await boss.schedule(QUEUES.npdLimitCheck, "0 9 * * *", {}, tz);
  await boss.schedule(QUEUES.gpuTick, "*/5 * * * *", {}, tz);
  await boss.schedule(QUEUES.purgeCartoonVoices, "40 3 * * *", {}, tz);

  // Удаление фото старше 7 дней (дублирует lifecycle бакета photos)
  await boss.work(QUEUES.purgePhotos, async () => {
    await purgeExpiredPhotos();
  });

  // Автоотмена неоплаченных: QR — 1 час, перевод — 24 часа (expiresAt задаётся при выборе способа).
  // «Я оплатил(а)» — не отменяется автоматически, решает оператор.
  await boss.work(QUEUES.cancelUnpaid, async () => {
    await db.order.updateMany({ where: { status: "PENDING_PAYMENT", expiresAt: { lt: new Date() } }, data: { status: "CANCELLED" } });
  });

  await boss.work(QUEUES.triggers, async () => runTriggers());
  await boss.work(QUEUES.referralBonuses, async () => issueDueBonuses());
  await boss.work(QUEUES.npdLimitCheck, async () => checkNpdLimit());
  await boss.work(QUEUES.gpuTick, async () => gpuTick());
  // Записи своего голоса для мультфильма — удалить через 30 дней после выдачи
  await boss.work(QUEUES.purgeCartoonVoices, async () => {
    await purgeCartoonVoices();
  });

  console.error("[worker] запущен");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
