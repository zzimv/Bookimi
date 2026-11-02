-- Исправления по отчётам 31.10.2026.
-- СДЭК: uuid заказа в СДЭК (номер отправления — trackNumber — приходит позже по этому uuid).
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "cdekUuid" TEXT;

-- Чеки: один действующий чек на заказ. Лишние «issued» (повторное прикрепление) — в «replaced», остаётся самый ранний.
UPDATE "Receipt" r SET "status" = 'replaced', "cancelledAt" = now()
WHERE r."status" = 'issued'
  AND EXISTS (SELECT 1 FROM "Receipt" o WHERE o."orderId" = r."orderId" AND o."status" = 'issued' AND (o."createdAt" < r."createdAt" OR (o."createdAt" = r."createdAt" AND o."id" < r."id")));
CREATE UNIQUE INDEX IF NOT EXISTS "Receipt_one_issued_per_order" ON "Receipt"("orderId") WHERE "status" = 'issued';
