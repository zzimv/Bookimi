#!/usr/bin/env bash
# Ежедневный бэкап БД в бакет backups (lifecycle 14 дней).
# cron на VPS: 30 3 * * * cd /opt/bookimi && ./backup.sh >> /var/log/bookimi-backup.log 2>&1
# Нужен aws-cli (apt install awscli), ключи берутся из .env.
set -euo pipefail
cd "$(dirname "$0")"
set -a; source .env; set +a

STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
FILE="/tmp/bookimi-${STAMP}.sql.gz"

docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner | gzip -9 > "$FILE"

AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
  aws --endpoint-url "$S3_ENDPOINT" --region "${S3_REGION:-ru-central1}" \
  s3 cp "$FILE" "s3://${S3_BUCKET_BACKUPS}/db/${STAMP}.sql.gz"

rm -f "$FILE"
echo "backup ok: ${STAMP}"

# Восстановление (см. README):
#   aws --endpoint-url "$S3_ENDPOINT" s3 cp s3://$S3_BUCKET_BACKUPS/db/<файл>.sql.gz - | gunzip \
#     | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
