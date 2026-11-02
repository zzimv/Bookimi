#!/usr/bin/env bash
# Восстановление базы из зашифрованного бэкапа (scripts/backup.sh).
#   scripts/restore.sh                      — последний бэкап из основного бакета
#   scripts/restore.sh bookimi-<дата>.dump.age [--from second] [--db <имя базы>]
# Ключ расшифровки: BACKUP_AGE_IDENTITY (файл ключа age) или ключ gpg в связке.
# База перезаписывается: pg_restore --clean --if-exists (объекты удаляются и создаются заново) — поэтому
# повторное восстановление и восстановление в непустую базу не падают на «already exists».
# Перед восстановлением на рабочем сервере: docker compose stop web worker.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
FILE="${1:-}"; FROM=primary; TARGET_DB="${POSTGRES_DB:?}"
shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --from) FROM="$2"; shift 2 ;;
    --db) TARGET_DB="$2"; shift 2 ;;
    *) echo "неизвестный параметр $1" >&2; exit 2 ;;
  esac
done
export RCLONE_CONFIG_PRIMARY_TYPE=s3 RCLONE_CONFIG_PRIMARY_PROVIDER=Other \
  RCLONE_CONFIG_PRIMARY_ENDPOINT="${S3_ENDPOINT:?}" RCLONE_CONFIG_PRIMARY_REGION="${S3_REGION:-ru-central1}" \
  RCLONE_CONFIG_PRIMARY_ACCESS_KEY_ID="${S3_ACCESS_KEY:?}" RCLONE_CONFIG_PRIMARY_SECRET_ACCESS_KEY="${S3_SECRET_KEY:?}"
if [ "$FROM" = second ]; then
  export RCLONE_CONFIG_SECOND_TYPE=s3 RCLONE_CONFIG_SECOND_PROVIDER=Other \
    RCLONE_CONFIG_SECOND_ENDPOINT="${BACKUP2_ENDPOINT:?}" RCLONE_CONFIG_SECOND_REGION="${BACKUP2_REGION:-ru-1}" \
    RCLONE_CONFIG_SECOND_ACCESS_KEY_ID="${BACKUP2_ACCESS_KEY:?}" RCLONE_CONFIG_SECOND_SECRET_ACCESS_KEY="${BACKUP2_SECRET_KEY:?}"
  SRC="second:${BACKUP2_BUCKET:?}/db"
else
  SRC="primary:${S3_BUCKET_BACKUPS:?}/db"
fi
if [ -z "$FILE" ]; then
  FILE=$(rclone lsf "$SRC" --include '*.dump.age' --include '*.dump.gpg' | sort | tail -1)
  [ -n "$FILE" ] || { echo "restore FAIL: бэкапов нет в $SRC" >&2; exit 1; }
fi
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
rclone copy "$SRC/$FILE" "$TMP/"
if rclone copy "$SRC/$FILE.sha256" "$TMP/" 2>/dev/null && [ -s "$TMP/$FILE.sha256" ]; then
  [ "$(sha256sum "$TMP/$FILE" | awk '{print $1}')" = "$(cat "$TMP/$FILE.sha256")" ] || { echo "restore FAIL: контрольная сумма не совпала" >&2; exit 1; }
fi
case "$FILE" in
  *.age) age -d -i "${BACKUP_AGE_IDENTITY:?укажите файл ключа age}" -o "$TMP/db.dump" "$TMP/$FILE" ;;
  *.gpg) gpg --batch --yes -o "$TMP/db.dump" --decrypt "$TMP/$FILE" ;;
  *) echo "restore FAIL: неизвестный формат $FILE" >&2; exit 1 ;;
esac
docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT 1 FROM pg_database WHERE datname = '$TARGET_DB'" | grep -q 1 \
  || docker compose exec -T db createdb -U "$POSTGRES_USER" "$TARGET_DB"
# Очередь pg-boss — секционированные таблицы: --clean не может снять их ограничения по одному, поэтому схему — целиком
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$TARGET_DB" -v ON_ERROR_STOP=1 -q -c "SET client_min_messages = warning; DROP SCHEMA IF EXISTS pgboss CASCADE"
docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$TARGET_DB" --clean --if-exists --no-owner --exit-on-error < "$TMP/db.dump"
echo "restore ok: $FILE → $TARGET_DB"
