-- Исправления по отчёту тестирования 30.10.2026.
-- 2FA: коды восстановления (хэши, одноразовые) и свежесть подтверждения для чувствительных действий.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstName" TEXT,
ADD COLUMN IF NOT EXISTS "totpRecovery" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "mfaAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "recoveryShow" TEXT;

-- Расходы на генерацию по тестовым книгам сотрудников — отдельный суточный лимит и серия на дашборде.
ALTER TABLE "GenerationCost" ADD COLUMN IF NOT EXISTS "staff" BOOLEAN NOT NULL DEFAULT false;
