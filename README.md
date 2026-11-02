# БУКИМИ (Bookimi)

Персональные детские книги по фото ребёнка. Next.js 15 (App Router, TypeScript) · PostgreSQL 16 · Prisma
(без бинарных движков) · pg-boss · Yandex Object Storage · Chromium для PDF · Docker Compose · Caddy.
Все персональные данные — только на серверах в РФ.

## Что внутри

| Часть | Где |
|---|---|
| Публичный сайт: главная (первый экран с полкой книг по макету владелицы; «скоро» для аудиторий и книг полки — Настройки → «Скоро»), книги с фильтрами, `/dlya/*` по аудиториям, поводы, книга, блог, документы; тёмная тема | `src/app/(страницы)`, `src/components`, `src/lib/storefront.ts`, `src/lib/shelf.ts`, `src/components/Shelf.tsx` |
| Анкета: сначала герои (фото — согласия один раз, обработка сразу — или описание), затем «Для кого и повод» → «Книга» (разделы повода) → «Группа» (детсад до 30, класс до 40, вставка списком) → «Детали»; книга выбрана — Герои → (Группа) → Детали. Сказка → вход (телефон + код на почту) → превью → оформление, «книга для каждого в группе» | `src/app/sozdat`, `src/components/quiz`, `src/lib/flow.ts`, `src/lib/photo-process.ts`, `src/lib/bulk.ts`, `src/components/book/BookFlow.tsx` |
| «Кто печатает книгу?», форматы, допы, доставка, промокод, расчёт суммы на сервере | `src/components/book/Checkout.tsx`, `src/lib/pricing.ts`, `src/lib/orders.ts` |
| Оплата: СБП-QR, перевод с подтверждением, ЮKassa (выкл.), чеки НПД | `src/lib/payments.ts`, `src/lib/npd.ts`, `src/app/zakaz` |
| Генерация: текст (YandexGPT, имя не уходит наружу), иллюстрации (Qwen на своём GPU), PDF, аудио | `src/lib/gen/*`, `src/lib/pdf.ts`, `tools/gpu-server` |
| Печать (email/API типографии), доставка (СДЭК API + тарифы), подсказки города и пункты выдачи (`/api/geo/*`), адресная книга | `src/lib/print.ts`, `src/lib/shipping.ts`, `src/lib/cities.ts`, `src/lib/delivery.ts` |
| Кабинет покупателя | `src/app/kabinet` |
| Кабинет администратора: роли, 2FA, дашборд, заказы, переводы, триггеры, каталог, настройки, журнал | `src/app/admin` |
| Уведомления: email, Telegram, MAX (WhatsApp — выкл.) | `src/lib/notify.ts` |
| «Приведи друга», триггеры и воронки | `src/lib/referral.ts`, `src/lib/triggers.ts` |
| SEO/GEO: sitemap, robots, llms.txt, catalog.json, agents.md, IndexNow, schema.org | `src/app/*.ts`, `src/lib/geo.ts` |
| «Мультфильм по книге»: сценарий, озвучка (диктор или свой голос), рендер ffmpeg, кабинет, ссылка «Поделиться» | `src/lib/gen/cartoon*.ts`, `src/lib/cartoon.ts`, `src/app/kabinet/kniga/[id]/mult`, `src/app/mult` |
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
- `backups` — удалять через 14 дней.

### Бэкапы
`scripts/backup.sh` (старый `./backup.sh` вызывает его): `pg_dump` в формате custom → шифрование **age** (`BACKUP_AGE_RECIPIENT`)
или gpg (`BACKUP_GPG_RECIPIENT`; без ключа скрипт не работает) → бакет `S3_BUCKET_BACKUPS` и второй S3-провайдер в РФ
(`BACKUP2_*`, хранение `BACKUP2_KEEP_DAYS`). Файлы книг (бакет `books`) — `rclone sync` во второй провайдер через
`rclone crypt` (`BACKUP_RCLONE_PASS`). Бакет `photos` не копируется: фото живут не дольше 7 дней. Нужны `rclone` и `age`
(`apt install rclone age`). Ключ для расшифровки (`age-keygen -o key.txt`) хранится **вне сервера**.
```cron
30 3 * * *  cd /opt/bookimi && scripts/backup.sh        >> /var/log/bookimi-backup.log 2>&1
0 5 1 * *   cd /opt/bookimi && scripts/restore-drill.sh >> /var/log/bookimi-backup.log 2>&1
```
- **Восстановление:** `docker compose stop web worker`, затем `BACKUP_AGE_IDENTITY=/путь/key.txt scripts/restore.sh` (последний
  бэкап) или `scripts/restore.sh bookimi-<дата>.dump.age [--from second]`; внутри — проверка контрольной суммы,
  `pg_restore --clean --if-exists` (повторный запуск не падает), схема очереди `pgboss` пересоздаётся; затем `docker compose up -d`.
- **Учебная проверка раз в месяц:** `scripts/restore-drill.sh` восстанавливает последний бэкап во временную базу
  `bookimi_drill`, проверяет пользователей, заказы и миграции, удаляет базу и пишет итог владелице в Telegram.

### GPU-сервер для иллюстраций
Инструкция — `tools/gpu-server/README.md`. После настройки: админка → Настройки → «Сервисы текста, иллюстраций и озвучки» → «Сервер иллюстраций» → «Свой GPU-сервер — основной вариант» (код `qwen`).
Режимы работы и лимит расходов — там же.

### Безопасность админки
Админка живёт только на **`admin.<DOMAIN>`** (переменная `ADMIN_HOST`) и открывается только из белого списка IP или через VPN.
- **Хосты.** На основном домене `/admin` и `/api/admin/*` отвечают 404 (middleware Next и Caddy). На admin-хосте открыты
  только админка и вход сотрудника (`/vhod`, `/api/auth/*`); любой другой путь — 301 на основной сайт. DNS: A-запись
  `admin` → IP сервера (сертификат Caddy выпускает сам).
- **Сессии.** Сотрудник входит только на admin-хосте; его сессия — отдельная (scope `staff`) в cookie `bk_staff`:
  только этот хост (без `Domain`), `SameSite=Strict`, `Secure`, `HttpOnly`, 12 часов. Сессия покупателя (`bk_session`
  на основном домене) админку не открывает никогда — и наоборот. Покупатель на admin-хосте войти не может (код не тратится).
- **Сеть (Caddy).** Admin-хост пропускает только `ADMIN_ALLOW_IPS` (CIDR через пробел) и подсеть VPN `ADMIN_VPN_SUBNET`,
  остальным — 403. По флагу `ADMIN_BASIC_AUTH=on` — ещё базовая авторизация Caddy (`ADMIN_BASIC_USER`,
  `ADMIN_BASIC_HASH` из `docker compose exec caddy caddy hash-password`). Журнал доступа — `/data/admin-access.log` в томе Caddy.
- **Заголовки.** `X-Robots-Tag: noindex`, строгая CSP без Метрики и сторонних скриптов, `frame-ancestors 'none'`,
  `no-store`; Метрика в админке не загружается.
- **Журнал и алерты.** Каждый вход сотрудника — в журнал с IP и устройством; вход с нового IP или устройства — алерт
  владелице. Админка → Команда: активные сессии (IP, устройство) с кнопкой «Завершить» и последние входы.
- **Аварийный выключатель:** `ADMIN_HOST_SEPARATION=0` возвращает админку на основной домен (без IP-фильтра Caddy —
  только на время починки DNS/VPN). Локально и в демо (DOMAIN не задан или localhost) разделение выключено.

**WireGuard для сотрудников** (пример; ключи — в `./wireguard`, папка в `.gitignore`):
1. `.env`: `WG_SERVER_PUBLIC_IP=<IP VPS>`, `WG_PEERS=owner,operator` (по имени на устройство), `ADMIN_VPN_SUBNET=10.13.13.0/24`.
2. Сервер: `docker compose --profile vpn up -d wireguard` (linuxserver/wireguard в сети хоста, порт UDP 51820 —
   открыть в файрволе). Сервер получает адрес `10.13.13.1`, устройства — `10.13.13.2…`.
3. Конфиги устройств: `./wireguard/peer_owner/peer_owner.conf` (или QR: `docker compose exec wireguard /app/show-peer owner`).
   В конфиге клиента `AllowedIPs = 10.13.13.0/24, <IP VPS>/32` — через туннель идёт только сервер (и админка), остальной
   интернет — напрямую. Пример клиента:
   ```ini
   [Interface]
   PrivateKey = <ключ устройства>
   Address = 10.13.13.2/32
   [Peer]
   PublicKey = <ключ сервера>
   Endpoint = bookimi.ru:51820
   AllowedIPs = 10.13.13.0/24, <IP VPS>/32
   PersistentKeepalive = 25
   ```
4. Сотрудник включает VPN и открывает `https://admin.bookimi.ru` — Caddy видит адрес `10.13.13.x` и пропускает.
   Без VPN — 403. Уволили подрядчика: удалить его peer (`WG_PEERS`, перезапуск контейнера), роль — в «Команде».
5. Docker должен сохранять адрес клиента: в `/etc/docker/daemon.json` — `"userland-proxy": false` (по умолчанию в новых версиях).

## Как добавить…
- **Сюжет** — в контент-движке: `src/content/plots/<аудитория>.ts` (12 разворотов: текст с метками и сцена),
  затем `npm run db:seed` (сюжет попадёт в таблицу `Story`). Название, описание, SEO, обложка и включение — в админке.
- **Формат или доп** — строка в таблице `ProductFormat`/`Addon` (через `prisma/seed.ts` и миграцию для работающей базы),
  цены, включение и аудитории (дети/подростки/взрослые/питомцы) — в админке. Файл для типографии — `src/lib/addon-files.ts`
  (`ADDON_FILES`: формат, вылеты 3 мм, страницы, материал), допы по аудиториям — ASSUMPTIONS.md, ДА1–ДА8.
- **Службу доставки** — метод в `src/lib/shipping.ts` (`ShipMethod`, `shipQuote`), включение — в админке.
- **Канал уведомлений** — функция отправки в `src/lib/notify.ts` и ветка в `notifyUser`.
- **Отзывы** — `data/REVIEWS.md` (импорт настоящих отзывов с разрешения авторов) и модерация в админке.

## Контент-движок
Все сюжеты, голоса книг, стили картинок и настроения — в `src/content/` (архитектура и правила —
`docs/content/ARCHITECTURE.md`). 4 аудитории (дети, подростки, взрослые, питомцы), 30 сюжетов, 14 голосов,
15 стилей иллюстраций, 11 настроений; проверка целостности — `validateContent()` (тест `tests/content.test.ts`, строгий).
- **Анкета** — `AnswersV2` (`src/content/answers.ts`, обёртка `src/lib/quiz.ts`); старые черновики разбираются.
- **Каталог** — `src/lib/catalog.ts`: таблица `Story` (seed из реестра) или реестр, если БД пуста:
  `getStories({ audience, segment })`, `getStoriesForOccasion(повод, аудитория)`; публичный срез без промптов.
- **Текст** — `src/lib/gen/text.ts`: YandexGPT получает системный промпт голоса + бриф (сегмент, план сюжета,
  крючки повода, роли доп. героев) и пишет метки; демо — готовые развороты сюжета. Имена подставляет `fillTags`.
- **Картинки** — `src/lib/gen/image.ts`: промпт стиля + сцена + герой по виду + настроение (`moodPrompt`);
  демо — SVG `renderDemoSpread` (`src/content/art/render.ts`). Смена настроения — действие `mood` у книги.
- `registry.ts` и `text-styles.ts` — только сервер; `npm run check:bundle-secrets` после сборки ловит промпты в бандле.

## Переход на ИП
Админка → Настройки → Налоговый режим: «ИП», заполнить наименование и ОГРНИП; Способы оплаты: включить ЮKassa
(ключи `PAYMENT_YOOKASSA_*` в `.env`). Чеки 54-ФЗ формирует касса ЮKassa по объекту `receipt` в платеже
(`src/lib/receipt54.ts`): позиции заказа со скидкой, доставка отдельной позицией, email/телефон покупателя; в Налоговом
режиме — код НДС (1 — без НДС для УСН/ПСН, 11 — 22% с 2026), код СНО и «касса на ФФД 1.2». Печатная книга — «полная
предоплата», при статусе «Доставлен» уходит чек зачёта предоплаты; PDF и цифровые допы — «полный расчёт». Пока ЮKassa
выключена, чеки не отправляются; счётчик лимита НПД отключается.

## Вход через VK ID, Яндекс ID, Mail.ru, Google

По умолчанию выключено — вход только по коду. Кнопка сервиса появляется на форме входа, когда в `.env` заданы оба ключа
(`src/lib/oauth.ts`, ASSUMPTIONS.md Р10). Адрес возврата для всех: `https://<DOMAIN>/api/auth/oauth/<id>/callback`.

| Сервис | Где зарегистрировать приложение | Переменные | id в адресе | Права |
|---|---|---|---|---|
| VK ID (рекомендуем первым) | id.vk.com → «Подключить VK ID» (кабинет VK ID для бизнеса) | `OAUTH_VKID_CLIENT_ID`, `OAUTH_VKID_CLIENT_SECRET` | `vkid` | почта, телефон |
| Яндекс ID (рекомендуем) | oauth.yandex.ru → «Создать приложение», веб-сервисы | `OAUTH_YANDEX_CLIENT_ID`, `OAUTH_YANDEX_CLIENT_SECRET` | `yandex` | `login:email`, `login:info`, `login:default_phone` |
| Mail.ru (VK Group) | o2.mail.ru/app → новое приложение | `OAUTH_MAILRU_CLIENT_ID`, `OAUTH_MAILRU_CLIENT_SECRET` | `mailru` | `userinfo` |
| Google | console.cloud.google.com → APIs & Services → Credentials → OAuth client ID (Web) | `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET` | `google` | `openid email profile` |

Google присылает нам имя и почту; мы персональные данные в Google не передаём. Выключить все кнопки сразу —
`OAUTH_DISABLED=1`. Сотрудники через внешние аккаунты не входят (код + 2FA).

## Оживление книги (бывш. «Мультфильм по книге»)
Покупатель получает ~2-минутный MP4 (1080×1080 и 9:16 для телефона) по иллюстрациям своей книги: камера и лёгкая анимация
героев, диктор или свой голос, субтитры, тихая музыка без чужих записей. Задача воркера `generate-cartoon`, нужен `ffmpeg`
(есть в образе). Образцы в демо-режиме без БД: `npx tsx scripts/cartoon-samples.ts <папка> ny cat own`.
С rev 10 по умолчанию выключено («скоро», `cartoon.enabled = false`) — включается в Настройках → «Оживление книги». Цены, длительность, голоса, музыка — там же. Подробности и допущения — ASSUMPTIONS.md, М1–М11.

## Важно для владельца
- **115-ФЗ.** Частые переводы на личную карту банк может проверить. Лучше отдельная карта и СБП-QR через
  сервис для самозанятых — он же формирует чеки.
- **Лимит НПД** 2,4 млн ₽ в год — на дашборде с прогнозом даты; письма при 80% и 95%.
- **Печать и физические допы** оформлены как изготовление книги на заказ с типографией-подрядчиком. Схему
  подтверждает бухгалтер; если нет — выключите печать в Настройках → Включение функций.
- **Приём фото** включается в Настройках после проверки текстов согласий юристом.
- **Тексты документов** — шаблоны; редактируются в Настройках → Тексты документов.
