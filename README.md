# adminpanelOS

Платформа агентства для сайтов клиентов. Каждый клиент получает уникальный сайт и свою админку (ячейку) на нашем, облачном или собственном сервере. Функционал подключается модулями через маркет. Агентство управляет всеми установками из раздела «Платформа» в CRM renoteOS.

## Статус

**Этап 2 — ядро ячейки** ([план](instructions/stage-2-core-plan.md)). Этап 1 «Платформа» решением владельца идёт после него.

- Архитектурные решения ADR-001…012 утверждены 2026-10-29.
- Ядро ячейки — Payload 4 ([ADR-012](instructions/adr/ADR-012-core-payload-4.md)) по итогам проверки: 82 из 90 ([отчёт](instructions/spike-payload-report.md)). Код проверки живёт в ветке `spike/payload` и в продукт не сливается.

**Готово:**

- веха 1 — каркас монорепозитория, ядро на Payload 4, worker очереди, health, CI;
- веха 2 — модульная система: SDK модулей, каталог в образе ядра, установка и удаление без потери данных, safe mode, бюджет фильтров, события через очередь, лицензии, модуль «Формы».

## Документация

| Что | Где |
|---|---|
| Архитектурные решения, глоссарий, дорожная карта, риски | [`instructions/adr/`](instructions/adr/README.md) |
| Правила работы в репозитории | [`CLAUDE.md`](CLAUDE.md) |
| Как написать модуль | [`instructions/modules.md`](instructions/modules.md) |

## Разработка

Нужны Docker и Node.js 24 (версия — в `.node-version`). Ячейка для разработки целиком работает в Docker:

```bash
npm run dev        # секреты и лицензии для разработки + запуск ячейки
sh deploy/dev/create-owner.sh   # владелец ячейки; почта и пароль — в deploy/dev/.env
npm run dev:logs   # логи ядра и worker
npm run dev:down   # остановить
```

| Что | Где |
|---|---|
| Админка | http://localhost:3200/admin |
| Модули | http://localhost:3200/admin/modules |
| Здоровье ячейки | http://localhost:3200/api/renote/health |
| S3-хранилище медиа | http://localhost:8333 |

Команды pnpm запускаются внутри контейнера ядра:

```bash
docker compose -f deploy/dev/compose.yml exec -w /repo core pnpm typecheck
```

Процессы ячейки:

- **core** — Payload 4 на Next.js: API и админка. Ставит задачи в очередь, но не выполняет их.
- **worker** — `core/src/worker.ts`: выполняет очередь задач и раз в 15 с пишет пульс. Если пульса нет 45 с, health показывает `degraded` с причиной.
- **postgres**, **s3** (SeaweedFS для разработки).

Схема БД в dev двигается автоматически только веб-процессом. Для production — миграции: `pnpm migrate:create <имя>` в контейнере ядра. Если Payload в dev не подхватил изменение коллекции или хука — перезапустить ядро: `docker compose -f deploy/dev/compose.yml restart core`.

### Тесты

```bash
docker compose -f deploy/dev/compose.yml exec -w /repo core pnpm test          # модульные тесты всех пакетов
docker compose -f deploy/dev/compose.yml exec -e TEST_DATABASE_URL=postgres://cell:<пароль>@postgres:5432/cell_test core pnpm test:int
```

Интеграционные тесты поднимают настоящий Payload на отдельной базе `cell_test` (создать один раз: `create database cell_test`) и проверяют модульную систему: safe mode, установку и удаление, лицензии, события, бюджет фильтров.

## Что будет в репозитории

По ADR-001 (готовое отмечено):

```
core/                 ядро ячейки: API, админка, worker   ✅
modules/*             модули: forms ✅, seo, redirects, legal
packages/
  module-sdk/         SDK модулей                         ✅
  eslint-config/      правила линтера для модулей          ✅
  platform-contracts/ общие контракты с renoteOS
  deploy-drivers/     драйверы выкладки: token, ssh, sftp, ftps, git
starters/site-node/   стартер уникального сайта
agent/                agent узла (reconciler)
cli/                  CLI renote
deploy/dev/           ячейка для разработки               ✅
instructions/         документация
test-scripts/         тестовые и утилитарные скрипты
```

Раздел «Платформа» (серверы, доступы, релизы, лицензии, маркет) разрабатывается в репозитории renoteOS.

## Прототип v1

Старый прототип лежит локально в `AdminPanel/AdminpanelOS` и в этот репозиторий не переносится. Что из него берётся, описано в [ADR-011](instructions/adr/ADR-011-legacy-code.md). Пути к файлам в ADR-011 указаны относительно прототипа.
