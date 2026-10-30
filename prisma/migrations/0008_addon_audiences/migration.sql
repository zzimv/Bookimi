-- Допы по аудиториям: у детей, подростков, взрослых и питомцев — свои наборы (ASSUMPTIONS.md, «Допы по аудиториям»).
-- audiences: пусто — для всех книг; supplier: print — типография по нашим файлам, other — другой подрядчик.
ALTER TABLE "Addon" ADD COLUMN IF NOT EXISTS "audiences" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "supplier" TEXT NOT NULL DEFAULT 'print';

-- Существующие допы: аудитории и порядок; описание и название — только если их не меняли в админке (= значения seed).
UPDATE "Addon" SET "audiences" = ARRAY['CHILD']::TEXT[], "sortOrder" = 0, "description" = CASE WHEN "description" = "title" THEN 'Ростомер с героем книги и шкалой роста — повесить в детской.' ELSE "description" END WHERE "key" = 'height-chart' AND "audiences" = ARRAY[]::TEXT[];
UPDATE "Addon" SET "audiences" = ARRAY['CHILD']::TEXT[], "sortOrder" = 1, "description" = CASE WHEN "description" = "title" THEN 'Коробка под книгу, карта мест из сказки и открытка с посвящением.' ELSE "description" END WHERE "key" = 'gift-box' AND "audiences" = ARRAY[]::TEXT[];
UPDATE "Addon" SET "audiences" = ARRAY['CHILD']::TEXT[], "sortOrder" = 2, "description" = CASE WHEN "description" = "title" THEN 'Лист наклеек с героем и картинками из сказки — на тетради и шкафчик.' ELSE "description" END WHERE "key" = 'stickers' AND "audiences" = ARRAY[]::TEXT[];
UPDATE "Addon" SET "audiences" = ARRAY['CHILD']::TEXT[], "sortOrder" = 3, "description" = CASE WHEN "description" = "title" THEN 'Обложка сказки с именем героя на плотной бумаге 29,7×42 см.' ELSE "description" END WHERE "key" = 'poster' AND "audiences" = ARRAY[]::TEXT[];
UPDATE "Addon" SET "audiences" = ARRAY['CHILD']::TEXT[], "sortOrder" = 4, "description" = CASE WHEN "description" = "title" THEN 'Контуры иллюстраций сказки — распечатать дома на А4 и раскрасить.' ELSE "description" END WHERE "key" = 'coloring' AND "audiences" = ARRAY[]::TEXT[];
UPDATE "Addon" SET "audiences" = ARRAY['CHILD']::TEXT[], "sortOrder" = 5, "description" = CASE WHEN "description" = "title" THEN 'Запишите сказку по страницам прямо в кабинете — ребёнок слушает ваш голос.' ELSE "description" END WHERE "key" = 'audio-self' AND "audiences" = ARRAY[]::TEXT[];
UPDATE "Addon" SET "audiences" = ARRAY['CHILD','TEEN','ADULT']::TEXT[], "sortOrder" = 22, "description" = CASE WHEN "description" = "title" THEN 'Книга голосом диктора — MP3 в кабинете и плеер на сайте.' ELSE "description" END WHERE "key" = 'audiobook' AND "audiences" = ARRAY[]::TEXT[];
UPDATE "Addon" SET "audiences" = ARRAY[]::TEXT[], "sortOrder" = 23, "description" = CASE WHEN "description" = "title" THEN 'Квадратный 1080×1080 и вертикальный 9:16 — для телевизора, сторис и коротких видео.' ELSE "description" END WHERE "key" = 'cartoon' AND "audiences" = ARRAY[]::TEXT[];
UPDATE "Addon" SET "audiences" = ARRAY['CHILD','ADULT']::TEXT[], "sortOrder" = 24, "description" = CASE WHEN "description" = "title" THEN 'Запишите реплики в кабинете — мультфильм соберётся с голосом близких.' ELSE "description" END WHERE "key" = 'cartoon-own-voice' AND "audiences" = ARRAY[]::TEXT[];
UPDATE "Addon" SET "audiences" = ARRAY[]::TEXT[], "sortOrder" = 25, "description" = CASE WHEN "description" = "title" THEN 'Ещё одна такая же печатная книга со скидкой.' ELSE "description" END WHERE "key" = 'second-copy' AND "audiences" = ARRAY[]::TEXT[];
UPDATE "Addon" SET "audiences" = ARRAY[]::TEXT[], "sortOrder" = 26, "description" = CASE WHEN "description" = "title" THEN 'Изготовим на 2 рабочих дня быстрее.' ELSE "description" END WHERE "key" = 'urgent' AND "audiences" = ARRAY[]::TEXT[];
UPDATE "Addon" SET "title" = '«Читаю сам»: аудиосказка вашим голосом' WHERE "key" = 'audio-self' AND "title" = 'Аудиокнига вашим голосом: запишите сами в кабинете';

-- Новые допы (на пустой базе их создаёт seed — ON CONFLICT ничего не меняет).
INSERT INTO "Addon" ("id", "key", "kind", "title", "description", "priceRub", "percentOff", "requiresPrint", "sortOrder", "isActive", "audiences", "supplier") VALUES
(gen_random_uuid(), 'teen-poster', 'PHYSICAL', 'Постер А3 в стиле книги', 'Иллюстрация из книги с названием — на стену в комнату, 29,7×42 см.', 590, NULL, true, 6, true, ARRAY['TEEN']::TEXT[], 'print'),
(gen_random_uuid(), 'teen-stickers', 'PHYSICAL', 'Стикерпак для ноутбука и телефона', 'Виниловые стикеры с героем и фразами из книги, вырезаны по контуру.', 390, NULL, true, 7, true, ARRAY['TEEN']::TEXT[], 'print'),
(gen_random_uuid(), 'teen-bookmarks', 'PHYSICAL', 'Закладки-карточки с героем (4 шт.)', 'Четыре двусторонние закладки 5×15 см с кадрами из книги.', 290, NULL, true, 8, true, ARRAY['TEEN']::TEXT[], 'print'),
(gen_random_uuid(), 'notebook', 'PHYSICAL', 'Скетчбук А5 с обложкой-иллюстрацией', 'Блокнот на пружине, 48 листов, обложка — иллюстрация из книги.', 690, NULL, true, 9, true, ARRAY['TEEN']::TEXT[], 'print'),
(gen_random_uuid(), 'wallpapers', 'DIGITAL', 'Обои для телефона и компьютера', 'Два файла PNG: 1170×2532 для телефона и 2560×1440 для компьютера.', 290, NULL, false, 10, true, ARRAY['TEEN']::TEXT[], 'print'),
(gen_random_uuid(), 'premium-box', 'PHYSICAL', 'Подарочная коробка премиум с открыткой', 'Плотная коробка под книгу с наклейкой-названием и открытка с вашим посвящением.', 690, NULL, true, 11, true, ARRAY['ADULT']::TEXT[], 'print'),
(gen_random_uuid(), 'postcards', 'PHYSICAL', 'Набор открыток с иллюстрациями книги (6 шт.)', 'Шесть открыток 10×15 см: на лицевой — иллюстрации, на обороте — место для слов.', 490, NULL, true, 12, true, ARRAY['ADULT']::TEXT[], 'print'),
(gen_random_uuid(), 'adult-calendar', 'PHYSICAL', 'Календарь 2027 с иллюстрациями книги', 'Настенный перекидной А4: 12 месяцев — 12 иллюстраций, праздники отмечены.', 990, NULL, true, 13, true, ARRAY['ADULT']::TEXT[], 'print'),
(gen_random_uuid(), 'adult-print', 'PHYSICAL', 'Принт А3 с иллюстрацией книги', 'Иллюстрация с паспарту и подписью на плотной бумаге 29,7×42 см — под рамку.', 590, NULL, true, 14, true, ARRAY['ADULT']::TEXT[], 'print'),
(gen_random_uuid(), 'bookmark', 'PHYSICAL', 'Закладка с иллюстрацией', 'Двусторонняя закладка 5×15 см с героем книги.', 190, NULL, true, 15, true, ARRAY['ADULT']::TEXT[], 'print'),
(gen_random_uuid(), 'framed-print', 'PHYSICAL', 'Принт А3 в раме', 'Принт с паспарту в деревянной раме под стеклом.', 2490, NULL, true, 16, false, ARRAY['ADULT']::TEXT[], 'other'),
(gen_random_uuid(), 'pet-poster', 'PHYSICAL', 'Постер А3 с питомцем', 'Портрет питомца из книги с кличкой крупно, 29,7×42 см.', 590, NULL, true, 17, true, ARRAY['PET']::TEXT[], 'print'),
(gen_random_uuid(), 'pet-calendar', 'PHYSICAL', 'Календарь 2027 с питомцем', 'Настенный перекидной А4: 12 месяцев с вашим питомцем, праздники отмечены.', 990, NULL, true, 18, true, ARRAY['PET']::TEXT[], 'print'),
(gen_random_uuid(), 'pet-postcards', 'PHYSICAL', 'Открытки и наклейки с питомцем', 'Четыре открытки 10×15 см и лист наклеек А5 с питомцем.', 390, NULL, true, 19, true, ARRAY['PET']::TEXT[], 'print'),
(gen_random_uuid(), 'pet-passport', 'PHYSICAL', '«Паспорт питомца»: карточка-вкладыш', 'Карточка 10×15 см: портрет, кличка, порода, окрас и графы, которые заполните сами.', 290, NULL, true, 20, true, ARRAY['PET']::TEXT[], 'print'),
(gen_random_uuid(), 'pet-magnet', 'PHYSICAL', 'Магнит с питомцем', 'Виниловый магнит 9×6 см с портретом питомца.', 350, NULL, true, 21, false, ARRAY['PET']::TEXT[], 'other')
ON CONFLICT ("key") DO NOTHING;
