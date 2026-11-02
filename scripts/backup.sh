#!/usr/bin/env bash
# Бэкап БУКИМИ: база PostgreSQL + бакет книг Object Storage, зашифрованно, в два места в РФ.
#   1) pg_dump (формат custom) → шифрование age (BACKUP_AGE_RECIPIENT) или gpg (BACKUP_GPG_RECIPIENT)
#      → основной бакет S3_BUCKET_BACKUPS (Yandex Object Storage, lifecycle 14 дней)
#      → второй провайдер в РФ (BACKUP2_*: Selectel / VK Cloud / Рег.облако — любой S3), хранение BACKUP2_KEEP_DAYS.
#   2) бакет books (иллюстрации, PDF, аудио) → rclone sync во второй провайдер через rclone crypt (BACKUP_RCLONE_PASS).
#      Бакет photos не копируется: фото детей хранятся не дольше 7 дней — копия продлила бы срок (152-ФЗ).
# Без ключа шифрования скрипт не работает: незашифрованный дамп с ПДн за пределы сервера не уходит.
#
# cron на VPS (README, «Бэкапы»):
#   30 3 * * *  cd /opt/bookimi && scripts/backup.sh            >> /var/log/bookimi-backup.log 2>&1
#   0 5 1 * *   cd /opt/bookimi && scripts/restore-drill.sh     >> /var/log/bookimi-backup.log 2>&1
# Нужны: docker compose, rclone (apt install rclone), age (apt install age) или gpg.
# Восстановление — scripts/restore.sh <имя файла> (README).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi

: "${POSTGRES_USER:?POSTGRES_USER не задан}" "${POSTGRES_DB:?POSTGRES_DB не задан}"
: "${S3_ENDPOINT:?}" "${S3_ACCESS_KEY:?}" "${S3_SECRET_KEY:?}" "${S3_BUCKET_BACKUPS:?}"
if [ -z "${BACKUP_AGE_RECIPIENT:-}" ] && [ -z "${BACKUP_GPG_RECIPIENT:-}" ]; then
  echo "backup FAIL: задайте BACKUP_AGE_RECIPIENT (age1…) или BACKUP_GPG_RECIPIENT — без шифрования бэкап не делаем" >&2
  exit 2
fi

# rclone без файла настроек: удалённые хранилища — из переменных окружения
export RCLONE_CONFIG_PRIMARY_TYPE=s3 RCLONE_CONFIG_PRIMARY_PROVIDER=Other \
  RCLONE_CONFIG_PRIMARY_ENDPOINT="$S3_ENDPOINT" RCLONE_CONFIG_PRIMARY_REGION="${S3_REGION:-ru-central1}" \
  RCLONE_CONFIG_PRIMARY_ACCESS_KEY_ID="$S3_ACCESS_KEY" RCLONE_CONFIG_PRIMARY_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
  RCLONE_CONFIG_PRIMARY_NO_CHECK_BUCKET=true
HAVE2=0
if [ -n "${BACKUP2_ENDPOINT:-}" ] && [ -n "${BACKUP2_BUCKET:-}" ]; then
  HAVE2=1
  export RCLONE_CONFIG_SECOND_TYPE=s3 RCLONE_CONFIG_SECOND_PROVIDER=Other \
    RCLONE_CONFIG_SECOND_ENDPOINT="$BACKUP2_ENDPOINT" RCLONE_CONFIG_SECOND_REGION="${BACKUP2_REGION:-ru-1}" \
    RCLONE_CONFIG_SECOND_ACCESS_KEY_ID="${BACKUP2_ACCESS_KEY:?}" RCLONE_CONFIG_SECOND_SECRET_ACCESS_KEY="${BACKUP2_SECRET_KEY:?}" \
    RCLONE_CONFIG_SECOND_NO_CHECK_BUCKET=true
  if [ -n "${BACKUP_RCLONE_PASS:-}" ]; then
    # Шифрованная «надстройка» над вторым бакетом для файлов книг (имена и содержимое)
    export RCLONE_CONFIG_SECONDCRYPT_TYPE=crypt RCLONE_CONFIG_SECONDCRYPT_REMOTE="second:${BACKUP2_BUCKET}/books" \
      RCLONE_CONFIG_SECONDCRYPT_PASSWORD="$(rclone obscure "$BACKUP_RCLONE_PASS")" \
      RCLONE_CONFIG_SECONDCRYPT_PASSWORD2="$(rclone obscure "${BACKUP_RCLONE_SALT:-$BACKUP_RCLONE_PASS-salt}")"
  fi
fi

STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
DUMP="$TMP/bookimi-${STAMP}.dump"

# 1. База: формат custom (pg_restore --clean --if-exists), без владельцев
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --format=custom --compress=9 > "$DUMP"
[ -s "$DUMP" ] || { echo "backup FAIL: пустой дамп" >&2; exit 1; }

if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  OUT="$DUMP.age"; age -r "$BACKUP_AGE_RECIPIENT" -o "$OUT" "$DUMP"
else
  OUT="$DUMP.gpg"; gpg --batch --yes --trust-model always -r "$BACKUP_GPG_RECIPIENT" -o "$OUT" --encrypt "$DUMP"
fi
rm -f "$DUMP"
sha256sum "$OUT" | awk '{print $1}' > "$OUT.sha256"

rclone copy "$OUT" "primary:${S3_BUCKET_BACKUPS}/db/" --s3-no-check-bucket
rclone copy "$OUT.sha256" "primary:${S3_BUCKET_BACKUPS}/db/" --s3-no-check-bucket
if [ "$HAVE2" = 1 ]; then
  rclone copy "$OUT" "second:${BACKUP2_BUCKET}/db/"
  rclone copy "$OUT.sha256" "second:${BACKUP2_BUCKET}/db/"
  rclone delete "second:${BACKUP2_BUCKET}/db/" --min-age "${BACKUP2_KEEP_DAYS:-60}d" || true
fi

# 2. Файлы книг — во второй провайдер (зашифрованно); без второго провайдера — пропуск с предупреждением
if [ "$HAVE2" = 1 ] && [ -n "${BACKUP_RCLONE_PASS:-}" ]; then
  rclone sync "primary:${S3_BUCKET_BOOKS:-bookimi-books}" "secondcrypt:" --fast-list --transfers 8 --checkers 16
else
  echo "backup WARN: второй провайдер (BACKUP2_*) или BACKUP_RCLONE_PASS не заданы — файлы книг не копируются"
fi

echo "backup ok: ${STAMP} ($(basename "$OUT"))"
