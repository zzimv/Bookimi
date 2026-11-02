-- rev 10: бонусы за отзыв, «изменить заказ» до оплаты, «Оживление книги» вместо «Мультфильма».
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "bonusRub" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "BonusEntry" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "amountRub" INTEGER NOT NULL,
  "orderId" UUID,
  "reviewId" UUID,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BonusEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BonusEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "BonusEntry_kind_orderId_key" ON "BonusEntry"("kind", "orderId");
CREATE INDEX IF NOT EXISTS "BonusEntry_userId_createdAt_idx" ON "BonusEntry"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "OrderChange" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "before" JSONB NOT NULL,
  "after" JSONB NOT NULL,
  "lines" TEXT[],
  "totalRub" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderChange_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OrderChange_orderId_createdAt_idx" ON "OrderChange"("orderId", "createdAt");

-- «Мультфильм по книге» → «Оживление книги» (только если название не меняли в админке)
UPDATE "Addon" SET "title" = 'Оживление книги: 2 минуты — иллюстрации оживают, диктор читает сказку' WHERE "key" = 'cartoon' AND "title" = 'Мультфильм по книге: 2 минуты с вашими героями и озвучкой';
UPDATE "Addon" SET "title" = 'Оживление книги своим голосом: озвучите сами по готовому сценарию', "description" = 'Запишите реплики в кабинете — ролик соберётся с голосом близких.' WHERE "key" = 'cartoon-own-voice' AND "title" = 'Мультфильм своим голосом: озвучите сами по готовому сценарию';
