// Фоновый воркер: отдельный контейнер `worker`.
// На шаге 2 — инфраструктура и регулярные задачи; обработчики генерации,
// PDF, оплаты и уведомлений добавляются на шагах 4–6.
import { PrismaClient } from "@prisma/client";
import { getBoss, QUEUES } from "../lib/queue";

const db = new PrismaClient();

async function main() {
  const boss = await getBoss();

  // Расписание (время — МСК)
  await boss.schedule(QUEUES.purgePhotos, "0 * * * *", {}, { tz: "Europe/Moscow" });
  await boss.schedule(QUEUES.cancelUnpaid, "*/5 * * * *", {}, { tz: "Europe/Moscow" });
  await boss.schedule(QUEUES.npdLimitCheck, "0 9 * * *", {}, { tz: "Europe/Moscow" });

  // Удаление фото старше 7 дней (дублирует lifecycle бакета photos).
  await boss.work(QUEUES.purgePhotos, async () => {
    const expired = await db.photo.findMany({
      where: { expiresAt: { lt: new Date() }, deletedAt: null },
      take: 500,
    });
    // Удаление объекта из S3 подключается на шаге 4 (StorageService).
    for (const p of expired) {
      await db.photo.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
    }
  });

  // Автоотмена неоплаченных заказов: QR — 1 час, перевод — 24 часа (expiresAt задаётся при создании).
  // Заказы, где покупатель нажал «Я оплатил(а)», не отменяются автоматически — их решает оператор.
  await boss.work(QUEUES.cancelUnpaid, async () => {
    await db.order.updateMany({
      where: { status: "PENDING_PAYMENT", expiresAt: { lt: new Date() } },
      data: { status: "CANCELLED" },
    });
  });

  console.error("[worker] started");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
