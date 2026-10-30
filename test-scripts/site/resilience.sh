#!/usr/bin/env bash
# Сайт на стартере: обновление после публикации и работа при упавшем ядре (веха 4).
#   bash test-scripts/site/resilience.sh
# Нужны: ячейка разработки с демо-контентом (seed-demo.mjs) и сайт в режиме ssr на :3220.
set -euo pipefail
cd "$(dirname "$0")/../.."
. deploy/dev/.env
COMPOSE="docker compose -f deploy/dev/compose.yml"
API=http://localhost:3200/api
SITE=http://localhost:3220

now() { python3 -c 'import time; print(time.time())'; }
since() { python3 -c "import time; print('%.1f' % (time.time() - $1))"; }

TOKEN=$(curl -s -X POST -H 'content-type: application/json' \
  -d "{\"email\":\"$DEV_OWNER_EMAIL\",\"password\":\"$DEV_OWNER_PASSWORD\"}" $API/users/login |
  python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
PAGE=$(curl -s "$API/pages?where%5Bpath%5D%5Bequals%5D=/kontakty&depth=0" | python3 -c 'import json,sys; print(json.load(sys.stdin)["docs"][0]["id"])')

echo "== обновление после публикации"
TITLE="Контакты $(date +%H%M%S)"
curl -s "$SITE/kontakty" >/dev/null # страница в кеше
t0=$(now)
curl -s -o /dev/null -X PATCH -H "Authorization: JWT $TOKEN" -H 'content-type: application/json' \
  -d "{\"title\":\"$TITLE\",\"_status\":\"published\"}" "$API/pages/$PAGE"
until curl -s "$SITE/kontakty" | grep -q "$TITLE"; do sleep 0.5; done
echo "  новый заголовок на сайте через $(since "$t0") с (worker забирает задачу раз в 5 с)"

echo "== ядро и worker остановлены"
$COMPOSE stop core worker >/dev/null 2>&1
for path in / /services /services/razrabotka /kontakty /legal/privacy /sitemap.xml /robots.txt /novaya-stranica; do
  curl -s -o /tmp/resilience.html -w "  $path → %{http_code} за %{time_total} с" --max-time 15 "$SITE$path"
  grep -q 'Сайт обновляется' /tmp/resilience.html && printf ' (страница «Сайт обновляется»)'
  echo
done
rm -f /tmp/resilience.html

$COMPOSE start core worker >/dev/null 2>&1
until curl -s $API/renote/health 2>/dev/null | grep -q '"ready"'; do sleep 2; done
echo "== ядро снова работает"
