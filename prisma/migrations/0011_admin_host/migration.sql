-- Админка на отдельном хосте: сессия сотрудника (scope = 'staff', cookie bk_staff на admin-хосте) отделена от сессии
-- покупателя (scope = 'customer', cookie bk_session на основном домене). IP и устройство — для журнала входов,
-- алертов о новом IP/устройстве и списка активных сессий в «Команде».
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'customer';
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "ip" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
-- Старые сессии сотрудников были общими с сайтом — завершаем: вход заново на admin-хосте
DELETE FROM "Session" s USING "User" u WHERE s."userId" = u."id" AND u."role" IN ('OWNER', 'OPERATOR', 'MARKETER') AND s."scope" = 'customer';
CREATE INDEX IF NOT EXISTS "Session_userId_scope_idx" ON "Session"("userId", "scope");
