# БУКИМИ (Bookimi)

Персональные детские книги по фото ребёнка. Next.js (App Router, TypeScript) + PostgreSQL 16 + Prisma + pg-boss,
Yandex Object Storage, Docker Compose, Caddy. Все персональные данные — только на серверах в РФ.

Статус: выполнены шаги 1 (протокол теста), 2 и 3 «Порядка работы». Шаги 4–7 — см. «Что осталось» в конце.

## Структура

```
prisma/schema.prisma     схема всего домена (каталог, герои, фото, книги, заказы, оплаты, чеки НПД,
                         печать, доставка, промокоды, рефералы, триггеры, воронка, отзывы, настройки, журнал)
prisma/seed.ts           значения по умолчанию из ТЗ (5 сюжетов, поводы, стили, форматы, допы, настройки)
src/lib/catalog-defaults.ts  те же значения — запасной вариант, пока БД пуста
src/lib/settings.ts      настройки и чек-лист «Готовность к продажам»
src/app/                 публичные страницы, /api/health
src/worker/index.ts      фоновый воркер (pg-boss): удаление фото, автоотмена заказов
tools/recognition-test/  шаг 1: протокол и скрипт теста узнаваемости
Dockerfile, docker-compose.yml, Caddyfile, backup.sh, .github/workflows/deploy.yml
```

## Локальный запуск

```bash
cp .env.example .env            # заполнить POSTGRES_*, остальное можно оставить пустым
docker compose up -d db
export DATABASE_URL=postgresql://bookimi:ПАРОЛЬ@localhost:5432/bookimi   # порт db пробросить или запустить postgres локально
npm ci
npx prisma migrate dev --name init   # первый раз: создаёт prisma/migrations/0001_init — закоммитьте её
npm run db:seed
npm run dev                     # http://localhost:3000
npm run worker                  # в отдельном терминале
```

Без `DATABASE_URL` сайт тоже открывается — каталог берётся из значений по умолчанию.

## Деплой на VPS (2 vCPU / 2 ГБ)

1. VPS в РФ с Docker и плагином compose. DNS: A-запись `bookimi.ru` (и `www`) → IP сервера.
2. `git clone` в `/opt/bookimi`, `cp .env.example .env`, заполнить, `chmod 600 .env`.
3. В GitHub → Settings → Secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`. В `.env` на сервере `IMAGE=ghcr.io/<владелец>/bookimi`.
4. Push в `main` → CI: typecheck → сборка образа (внутри — проверка бандла на секреты) → GHCR →
   по SSH `docker compose pull && docker compose up -d` → `prisma migrate deploy` → проверка `/api/health`.
   Если health не ответил за 100 секунд — откат на предыдущий тег образа.
5. Первый раз после деплоя: `docker compose run --rm web node_modules/.bin/tsx prisma/seed.ts`.

SSL выпускает Caddy автоматически. Дополнительные домены — в `EXTRA_DOMAINS` через запятую
(кириллические — в punycode), они отдают 301 на основной.

**Ручной запасной способ:** на сервере `git pull && docker compose up -d --build`, затем
`docker compose run --rm web node_modules/.bin/prisma migrate deploy`.

Миграции должны быть обратно совместимыми (сначала добавить, потом удалять): откат образа не откатывает БД.

## Бэкапы

`backup.sh` делает `pg_dump` в бакет `backups` (lifecycle 14 дней). Cron:
`30 3 * * * cd /opt/bookimi && ./backup.sh >> /var/log/bookimi-backup.log 2>&1`

Восстановление:
```bash
aws --endpoint-url https://storage.yandexcloud.net s3 ls s3://$S3_BUCKET_BACKUPS/db/
aws --endpoint-url https://storage.yandexcloud.net s3 cp s3://$S3_BUCKET_BACKUPS/db/<файл>.sql.gz - | gunzip \
  | docker compose exec -T db psql -U $POSTGRES_USER -d $POSTGRES_DB
```

## Бакеты Yandex Object Storage

- `photos` — правило жизненного цикла: удалять объекты через 7 дней. Дублируется задачей воркера `purge-photos`.
- `books` — без срока, приватный, выдача только по подписанным ссылкам на 15 минут.
- `backups` — удалять через 14 дней.

## Как добавить сюжет, формат, доп

Сейчас — через seed или напрямую в БД (таблицы `Story`, `ProductFormat`, `Addon`); с шагом 6 — в кабинете
администратора без выкладки. Цены на сайте читаются из БД, кэш страниц — 5 минут.
Службы доставки и каналы уведомлений добавляются как реализации адаптеров `ShippingProvider` и
`NotificationChannel` (шаг 6).

## Налоговый режим и переход на ИП

Настройка `tax.regime` (`npd` | `ip`). При `ip` в футере и документах подставляются реквизиты ИП, чек формируется
по 54-ФЗ через онлайн-кассу, платёжный провайдер — ЮKassa (адаптер, `PAYMENT_PROVIDER=yookassa`). Реализация — шаг 5.

## Важно для владельца

- **115-ФЗ.** Частые переводы на личную карту банк может проверить. Заведите отдельную карту для продаж и
  используйте СБП-QR через сервис для самозанятых — он же сам формирует чеки НПД.
- **Лимит НПД** — 2,4 млн ₽ в год; счётчик и уведомления при 80% и 95% — в дашборде (шаг 6).
- **Печать и физические допы** оформляются как изготовление книги на заказ с привлечением типографии-подрядчика.
  Схему должен подтвердить бухгалтер; если нет — выключите печать в настройках (`flags.printEnabled`).
- Тексты оферты, политики и согласий — шаблоны; перед запуском их проверяет юрист.
