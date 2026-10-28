# БУКИМИ (Bookimi)

Персональные детские книги по фото ребёнка. Next.js 15 (App Router, TypeScript) · PostgreSQL 16 · Prisma
(без бинарных движков) · pg-boss · Yandex Object Storage · Chromium для PDF · Docker Compose · Caddy.
Все персональные данные — только на серверах в РФ.

## Что внутри

| Часть | Где |
|---|---|
| Публичный сайт: главная, сказки, поводы, возраст, блог, документы | `src/app/(страницы)`, `src/components` |
| Квиз (7 шагов, без фото) → сказка → согласие → фото → вход по коду → превью | `src/app/sozdat`, `src/components/quiz`, `src/components/book/BookFlow.tsx` |
| «Кто печатает книгу?», форматы, допы, доставка, промокод, расчёт суммы на сервере | `src/components/book/Checkout.tsx`, `src/lib/pricing.ts`, `src/lib/orders.ts` |
| Оплата: СБП-QR, перевод с подтверждением, ЮKassa (выкл.), чеки НПД | `src/lib/payments.ts`, `src/lib/npd.ts`, `src/app/zakaz` |
| Генерация: текст (YandexGPT, имя не уходит наружу), иллюстрации (Qwen на своём GPU), PDF, аудио | `src/lib/gen/*`, `src/lib/pdf.ts`, `tools/gpu-server` |
| Печать (email/API типографии), доставка (СДЭК API + тарифы) | `src/lib/print.ts`, `src/lib/shipping.ts` |
| Кабинет покупателя | `src/app/kabinet` |
| Кабинет администратора: роли, 2FA, дашборд, заказы, переводы, триггеры, каталог, настройки, журнал | `src/app/admin` |
| Уведомления: email, Telegram, MAX (WhatsApp — выкл.) | `src/lib/notify.ts` |
| «Приведи друга», триггеры и воронки | `src/lib/referral.ts`, `src/lib/triggers.ts` |
| SEO/GEO: sitemap, robots, llms.txt, catalog.json, agents.md, IndexNow, schema.org | `src/app/*.ts`, `src/lib/geo.ts` |
| Фоновые задачи (воркер) | `src/worker/index.ts` |
| Тест узнаваемости (шаг 1) | `tools/recognition-test` |

Демо-режим (`DEMO_MODE=1`) проходит весь путь без внешних сервисов: демо-сказка из шаблонов, SVG-иллюстрации,
оплата «понарошку», коды входа на экране. **В продакшне `DEMO_MODE=0`.**

## Локальный запуск

```bash
cp .env.example .env              # для локального: DATABASE_URL, DEMO_MODE=1, STORAGE_DRIVER=local, SESSION_SECRET
npm ci
npm run db:local &                # PostgreSQL 16 без Docker на порту 5433 (или docker compose up -d db)
export DATABASE_URL=postgresql://bookimi:bookimi@localhost:5433/bookimi
npm run db:migrate && npm run db:seed
DEMO_MODE=1 npm run db:demo       # демо-реквизиты, оплата, пользователи owner/operator/marketer@bookimi.demo
npm run dev                       # http://localhost:3000
npm run worker                    # в отдельном терминале
```

Вход в админку: `/vhod` → `owner@bookimi.demo` → код появится на экране (демо).

## Тесты

```bash
npm test                          # 30 тестов: расчёт сумм, склонение имён, модерация, подписи и 2FA, лимит НПД,
                                  # + на БД: оплата QR и переводом, идемпотентность, чеки, возврат, «Приведи друга»,
                                  # удаление фото через 7 дней, лимиты превью
npm run smoke -- http://localhost:3000 <id-заказа>   # 21 проверка на работающем сайте: заголовки, CSRF,
                                  # чужая книга/заказ → 404, PDF без оплаты → 403, превышение лимита → 429
npm run check:bundle-secrets      # в клиентском бандле нет ключей и промптов
```
Нагрузка: `k6 run -e BASE=https://bookimi.ru tools/load/k6.js` (50 пользователей). Скорость: Lighthouse CI в GitHub Actions
(`lighthouserc.json`, оценка < 90 — выкладка блокируется).

## Деплой на VPS (2 vCPU / 2 ГБ)

1. VPS в РФ с Docker. DNS: A-записи `bookimi.ru` и `www` → IP сервера.
2. `git clone` в `/opt/bookimi`, `cp .env.example .env`, заполнить, `chmod 600 .env`. `DEMO_MODE=0`.
3. GitHub → Settings → Secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`.
4. Push в `main` → CI: типы → тесты на PostgreSQL → образ (сборка + проверка бандла) → Lighthouse → по SSH
   `docker compose pull && up -d` → миграции (`node scripts/migrate.mjs`) → `/api/health`. Не ответил за 100 с — откат.
5. Первый раз: `docker compose run --rm web node_modules/.bin/tsx prisma/seed.ts`, затем зайти в админку
   и пройти чек-лист «Готовность к продажам».

Запасной способ: `git pull && docker compose up -d --build && docker compose run --rm web node scripts/migrate.mjs`.
SSL выпускает Caddy. Дополнительные домены — `EXTRA_DOMAINS` (301 на основной).
Миграции пишутся обратно совместимыми: откат образа не откатывает базу.

### Бакеты Yandex Object Storage
- `photos` — правило жизненного цикла: удалять через 7 дней (плюс задача воркера каждые 30 минут).
- `books` — без срока, приватный; файлы отдаются по подписанным ссылкам на 15 минут.
- `backups` — удалять через 14 дней. Бэкап: `backup.sh` по cron, восстановление — в комментарии в конце скрипта.

### GPU-сервер для иллюстраций
Инструкция — `tools/gpu-server/README.md`. После настройки: админка → Настройки → ИИ-провайдеры → «Qwen».
Режимы работы и лимит расходов — там же.

## Как добавить…
- **Сюжет** — админка → Каталог и цены (текст, возраст, порядок, обложка, указания для ИИ). Для готовых
  разворотов и описаний сцен — `src/lib/story-plans.ts` (12 разворотов: текст-пример и сцена).
- **Формат или доп** — строка в таблице `ProductFormat`/`Addon` (через `prisma/seed.ts`), цены и включение — в админке.
- **Службу доставки** — метод в `src/lib/shipping.ts` (`ShipMethod`, `shipQuote`), включение — в админке.
- **Канал уведомлений** — функция отправки в `src/lib/notify.ts` и ветка в `notifyUser`.
- **Отзывы** — `data/REVIEWS.md` (импорт настоящих отзывов с разрешения авторов) и модерация в админке.

## Переход на ИП
Админка → Настройки → Налоговый режим: «ИП», заполнить наименование и ОГРНИП; Способы оплаты: включить ЮKassa
(ключи `PAYMENT_YOOKASSA_*` в `.env`). Чеки 54-ФЗ формирует касса ЮKassa; счётчик лимита НПД отключается.

## Важно для владельца
- **115-ФЗ.** Частые переводы на личную карту банк может проверить. Лучше отдельная карта и СБП-QR через
  сервис для самозанятых — он же формирует чеки.
- **Лимит НПД** 2,4 млн ₽ в год — на дашборде с прогнозом даты; письма при 80% и 95%.
- **Печать и физические допы** оформлены как изготовление книги на заказ с типографией-подрядчиком. Схему
  подтверждает бухгалтер; если нет — выключите печать в Настройках → Включение функций.
- **Приём фото** включается в Настройках после проверки текстов согласий юристом.
- **Тексты документов** — шаблоны; редактируются в Настройках → Тексты документов.
