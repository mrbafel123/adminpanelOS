#!/usr/bin/env sh
# Создаёт владельца локальной ячейки из DEV_OWNER_* в deploy/dev/.env.
# Если владелец уже есть, ничего не делает.
set -eu
cd "$(dirname "$0")"
. ./.env
curl -sf -o /dev/null -X POST -H 'content-type: application/json' \
  -d "{\"email\":\"$DEV_OWNER_EMAIL\",\"password\":\"$DEV_OWNER_PASSWORD\",\"name\":\"Владелец\"}" \
  http://localhost:3200/api/users/first-register \
  && echo "Владелец создан: $DEV_OWNER_EMAIL (пароль — в deploy/dev/.env)" \
  || echo "Владелец уже есть или ядро не запущено"
