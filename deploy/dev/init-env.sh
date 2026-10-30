#!/usr/bin/env sh
# Создаёт deploy/dev/.env со случайными секретами для локальной ячейки.
# Повторный запуск ничего не меняет.
set -eu
cd "$(dirname "$0")"
[ -f .env ] && { echo ".env уже есть"; exit 0; }
rand() { openssl rand -hex "$1"; }
S3_KEY=$(rand 10)
S3_SECRET=$(rand 20)
cat > .env <<ENV
POSTGRES_PASSWORD=$(rand 16)
PAYLOAD_SECRET=$(rand 32)
S3_BUCKET=media
S3_ACCESS_KEY_ID=$S3_KEY
S3_SECRET_ACCESS_KEY=$S3_SECRET
SITE_ORIGINS=http://localhost:3220
SITE_URL=http://localhost:3220
# Ядро сообщает сайту об изменениях; сайт поднимается профилем site
SITE_REVALIDATE_URL=http://site:3000/api/revalidate
SITE_REVALIDATE_SECRET=$(rand 16)
DEV_OWNER_EMAIL=owner@dev.local
DEV_OWNER_PASSWORD=$(rand 12)
ENV
cat > s3.json <<JSON
{ "identities": [{ "name": "cell", "credentials": [{ "accessKey": "$S3_KEY", "secretKey": "$S3_SECRET" }], "actions": ["Admin", "Read", "Write", "List", "Tagging"] }] }
JSON
echo "Создан deploy/dev/.env и s3.json"
