-- «Мультфильм по книге»: мультфильм книги (сценарий, голос, ссылка «Поделиться», срок удаления записей голоса),
-- согласие на обработку голоса (VOICE), допы «Мультфильм по книге» и «Своим голосом». SQL сверен с prisma migrate diff.
-- CreateEnum
CREATE TYPE "CartoonStatus" AS ENUM ('PENDING', 'QUEUED', 'RENDERING', 'READY', 'FAILED');

-- AlterEnum
ALTER TYPE "ConsentType" ADD VALUE IF NOT EXISTS 'VOICE';

-- CreateTable
CREATE TABLE "Cartoon" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "status" "CartoonStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "voiceMode" TEXT NOT NULL DEFAULT 'auto',
    "ownVoicePaid" BOOLEAN NOT NULL DEFAULT false,
    "voice" TEXT,
    "subtitles" BOOLEAN NOT NULL DEFAULT true,
    "script" JSONB,
    "textHash" TEXT,
    "voiceCues" JSONB,
    "renderedKey" TEXT,
    "rerendersLeft" INTEGER NOT NULL DEFAULT 1,
    "ownBuildsLeft" INTEGER NOT NULL DEFAULT 3,
    "durationSec" DOUBLE PRECISION,
    "renderSeconds" DOUBLE PRECISION,
    "deliveredAt" TIMESTAMP(3),
    "voicePurgeAt" TIMESTAMP(3),
    "voicePurgedAt" TIMESTAMP(3),
    "shareToken" TEXT,
    "shareExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cartoon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cartoon_bookId_key" ON "Cartoon"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "Cartoon_shareToken_key" ON "Cartoon"("shareToken");

-- CreateIndex
CREATE INDEX "Cartoon_voicePurgeAt_idx" ON "Cartoon"("voicePurgeAt");

-- AddForeignKey
ALTER TABLE "Cartoon" ADD CONSTRAINT "Cartoon_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Допы (цены берутся из настроек cartoon.priceRub / cartoon.ownVoiceRub; seed добавит их и в новой базе)
INSERT INTO "Addon" ("id", "key", "kind", "title", "description", "priceRub", "requiresPrint", "sortOrder", "isActive")
VALUES
  (gen_random_uuid(), 'cartoon', 'DIGITAL', 'Мультфильм по книге: 2 минуты с вашими героями и озвучкой', 'Мультфильм по книге: 2 минуты с вашими героями и озвучкой', 690, false, 9, true),
  (gen_random_uuid(), 'cartoon-own-voice', 'MODIFIER', 'Мультфильм своим голосом: озвучите сами по готовому сценарию', 'Мультфильм своим голосом: озвучите сами по готовому сценарию', 400, false, 10, true)
ON CONFLICT ("key") DO NOTHING;
