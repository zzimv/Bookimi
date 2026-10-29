-- Путь создания книги (герои с фото в начале) и «книга для каждого в группе».
-- Фото: исходник (для выбора другого лица) и метаданные обработки (лица, подсказки, метрики).
ALTER TABLE "Photo" ADD COLUMN "originalKey" TEXT,
ADD COLUMN "meta" JSONB;

-- Копии заказа «для каждого»: книга, от которой сделана копия (герой — другой ребёнок группы).
ALTER TABLE "Book" ADD COLUMN "parentBookId" UUID;
CREATE INDEX "Book_parentBookId_idx" ON "Book"("parentBookId");

-- Отдельное согласие: фото других детей группы загружаются с согласия их родителей.
ALTER TYPE "ConsentType" ADD VALUE IF NOT EXISTS 'GROUP_PHOTO';
