#!/usr/bin/env bash
# Совместимость со старым cron: бэкап теперь в scripts/backup.sh (БД + файлы книг, шифрование, второй провайдер).
exec "$(dirname "$0")/scripts/backup.sh" "$@"
