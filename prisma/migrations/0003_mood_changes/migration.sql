-- Смена настроения иллюстраций: счётчики до и после оплаты (правила — ASSUMPTIONS.md)
ALTER TABLE "Book" ADD COLUMN "moodChangesPreview" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "moodChangesFull" INTEGER NOT NULL DEFAULT 0;
