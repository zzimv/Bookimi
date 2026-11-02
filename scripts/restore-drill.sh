#!/usr/bin/env bash
# Ежемесячная учебная проверка восстановления: последний бэкап → временная база bookimi_drill → проверки → удаление.
# Рабочую базу не трогает. Итог — в лог и владельцу (Telegram-бот алертов, если задан TELEGRAM_BOT_TOKEN и TELEGRAM_ALERT_CHAT_ID).
# cron: 0 5 1 * * cd /opt/bookimi && scripts/restore-drill.sh >> /var/log/bookimi-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
DRILL=bookimi_drill
notify() {
  echo "$1"
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_ALERT_CHAT_ID:-}" ]; then
    curl -s -m 10 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" -d chat_id="$TELEGRAM_ALERT_CHAT_ID" --data-urlencode text="$1" > /dev/null || true
  fi
}
cleanup() { docker compose exec -T db dropdb -U "$POSTGRES_USER" --if-exists "$DRILL" > /dev/null 2>&1 || true; }
trap 'cleanup; notify "Проверка восстановления бэкапа: ОШИБКА (см. /var/log/bookimi-backup.log)"' ERR
cleanup
START=$(date +%s)
scripts/restore.sh "" --db "$DRILL"
q() { docker compose exec -T db psql -U "$POSTGRES_USER" -d "$DRILL" -tA -v ON_ERROR_STOP=1 -c "$1"; }
USERS=$(q 'SELECT count(*) FROM "User"')
ORDERS=$(q 'SELECT count(*) FROM "Order"')
LAST_MIG=$(q 'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name DESC LIMIT 1')
LAST_ORDER=$(q 'SELECT coalesce(max("createdAt")::text, $$—$$) FROM "Order"')
[ "$USERS" -gt 0 ] || { echo "в восстановленной базе нет пользователей" >&2; false; }
cleanup
trap - ERR
notify "Проверка восстановления бэкапа: ок за $(( $(date +%s) - START )) с. Пользователей $USERS, заказов $ORDERS, последний заказ $LAST_ORDER, миграция $LAST_MIG."
