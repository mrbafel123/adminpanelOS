import type { ModuleContributions, ModuleManifest } from '@renote/module-sdk'
import {
  addDataAndFileToRequest,
  commitTransaction,
  definePlugin,
  initTransaction,
  killTransaction,
  type Access,
  type CollectionConfig,
  type CollectionSlug,
  type Config,
  type Endpoint,
  type Field,
  type GlobalConfig,
  type Plugin,
} from 'payload'

import { canEdit, isLoggedIn } from '../access/roles'
import { modulesEndpoints } from './endpoints'
import { eventTasks } from './events'
import { checkLicense, isWritable } from './license'
import { CellModules, refreshInstalled } from './lifecycle'
import { blockSlug, collectionSlug, settingsSlug, tableName } from './naming'
import { isActive, register, registry, setStatus, type ModuleEntry } from './registry'
import { createRuntime } from './runtime'
import { schemaToFields } from './settings-schema'
import type { CatalogEntry } from './types'

const SETUP_TIMEOUT_MS = 3000
const INSTALLED_REFRESH_MS = 10_000
const LICENSE_GATE = '/modules/admin/LicenseGate#LicenseGate'

const withTimeout = <T>(work: T | Promise<T>, ms: number, what: string) => {
  let timer: NodeJS.Timeout | undefined
  return Promise.race([
    Promise.resolve(work),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what}: нет ответа за ${ms} мс`)), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

// Kill switch (ADR-003): Платформа выключает модуль или его версию — `forms` или `forms@1.0.0`.
const isKilled = (m: ModuleManifest) => {
  const killed = (process.env.RENOTE_KILLED_MODULES ?? '').split(',').map((s) => s.trim())
  return killed.includes(m.id) || killed.includes(`${m.id}@${m.version}`)
}

// Данные модуля доступны, только если он установлен и не выключен.
// Лицензия ограничивает лишь запись (ADR-008).
const gate =
  (entry: ModuleEntry, op: 'read' | 'write', inner: Access | undefined, fallback: Access): Access =>
  (args) => {
    if (!entry.installed || entry.status === 'disabled') return false
    if (op === 'write' && !isWritable(checkLicense(entry.manifest))) return false
    return (inner ?? fallback)(args)
  }

const hidden = (entry: ModuleEntry) => () => !entry.installed || entry.status === 'disabled'
const menuGroup = (m: ModuleManifest) => m.admin?.menu?.title ?? m.name
const gateComponent = (moduleId: string) => ({ path: LICENSE_GATE, clientProps: { moduleId } })

const buildCollections = (entry: ModuleEntry, c: ModuleContributions): CollectionConfig[] =>
  (c.collections ?? []).map(({ name, access = {}, admin = {}, ...rest }) => {
    const slug = collectionSlug(entry.manifest.id, name)
    entry.collections.push(slug)
    return {
      ...rest,
      slug,
      dbName: tableName(entry.manifest.id, name),
      access: {
        ...access,
        read: gate(entry, 'read', access.read, isLoggedIn),
        create: gate(entry, 'write', access.create, canEdit),
        update: gate(entry, 'write', access.update, canEdit),
        delete: gate(entry, 'write', access.delete, canEdit),
      },
      admin: {
        ...admin,
        group: menuGroup(entry.manifest),
        hidden: hidden(entry),
        components: {
          ...admin.components,
          beforeList: [gateComponent(entry.manifest.id), ...(admin.components?.beforeList ?? [])],
          edit: { ...admin.components?.edit, beforeDocumentControls: [gateComponent(entry.manifest.id)] },
        },
      },
    }
  })

const buildSettings = (entry: ModuleEntry, catalog: CatalogEntry): GlobalConfig[] => {
  const { manifest } = entry
  if (!catalog.settingsSchema) return []
  return [
    {
      slug: settingsSlug(manifest.id),
      dbName: tableName(manifest.id, 'settings'),
      label: `${menuGroup(manifest)}: настройки`,
      // История версий настроек модуля не нужна.
      versions: false,
      admin: {
        group: menuGroup(manifest),
        hidden: hidden(entry),
        components: { edit: { beforeDocumentControls: [gateComponent(manifest.id)] } },
      },
      access: {
        read: gate(entry, 'read', undefined, isLoggedIn),
        update: gate(entry, 'write', undefined, canEdit),
      },
      fields: schemaToFields(catalog.settingsSchema),
    },
  ]
}

// Маршруты модуля живут в /api/m/<id>/ и выполняются в транзакции:
// данные и события фиксируются вместе или не фиксируются вовсе.
const buildEndpoints = (entry: ModuleEntry, c: ModuleContributions): Endpoint[] =>
  (c.endpoints ?? []).map((ep) => ({
    path: `/m/${entry.manifest.id}${ep.path}`,
    method: ep.method,
    handler: async (req) => {
      if (!isActive(entry.manifest.id)) return unavailable()
      const shouldCommit = await initTransaction(req)
      try {
        await addDataAndFileToRequest(req)
        const result = await ep.handler(
          {
            method: ep.method,
            params: (req.routeParams ?? {}) as Record<string, string>,
            query: req.query ?? {},
            body: req.data,
            user: req.user ? { id: req.user.id, role: (req.user as { role?: string }).role } : null,
            ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
          },
          createRuntime(entry, req),
        )
        if (shouldCommit) await commitTransaction(req)
        return Response.json(result.body, { status: result.status ?? 200 })
      } catch (err) {
        await killTransaction(req)
        req.payload.logger.error({ err, module: entry.manifest.id }, 'Ошибка в маршруте модуля')
        return Response.json({ error: 'Внутренняя ошибка модуля' }, { status: 500 })
      }
    },
  }))

const unavailable = () => Response.json({ error: 'Модуль временно недоступен' }, { status: 503 })

// Блоки модуля попадают во все поля-конструкторы, помеченные custom.renoteBlocks.
const injectBlocks = (config: Config, entry: ModuleEntry, c: ModuleContributions) => {
  if (!c.blocks?.length) return config.collections ?? []
  const blocks = c.blocks.map(({ name, ...rest }) => ({ ...rest, slug: blockSlug(entry.manifest.id, name) }))
  const visit = (fields: Field[]): Field[] =>
    fields.map((f) =>
      f.type === 'blocks' && f.custom?.renoteBlocks ? { ...f, blocks: [...(f.blocks ?? []), ...blocks] } : f,
    )
  return (config.collections ?? []).map((col) => ({ ...col, fields: visit(col.fields) }))
}

// Поля модуля попадают в коллекции ядра, помеченные custom.renoteFields (страницы),
// одной группой с именем модуля: в базе это колонки `<id>_*` таблицы ядра.
// В админке группа видна, только пока модуль установлен и не выключен.
const injectFields = (collections: CollectionConfig[], entry: ModuleEntry, c: ModuleContributions) => {
  const fields = c.fields?.pages
  if (!fields?.length) return collections
  const group: Field = {
    name: entry.manifest.id,
    type: 'group',
    label: entry.manifest.name,
    admin: { condition: () => entry.installed && entry.status !== 'disabled' },
    fields,
  }
  return collections.map((col) =>
    col.slug === 'pages' && col.custom?.renoteFields ? { ...col, fields: [...col.fields, group] } : col,
  )
}

const applyContributions = (
  config: Config,
  entry: ModuleEntry,
  c: ModuleContributions,
  catalog: CatalogEntry,
) => {
  const consumes = entry.manifest.events?.consumes ?? []
  for (const event of Object.keys(c.on ?? {})) {
    if (!consumes.includes(event)) throw new Error(`подписка на ${event} не объявлена в манифесте`)
  }
  // Сначала всё собирается, потом применяется разом: упавший модуль не оставит половину конфига.
  const next: Config = {
    ...config,
    collections: [...injectFields(injectBlocks(config, entry, c), entry, c), ...buildCollections(entry, c)],
    globals: [...(config.globals ?? []), ...buildSettings(entry, catalog)],
    endpoints: [...(config.endpoints ?? []), ...buildEndpoints(entry, c)],
  }
  entry.filters = c.filters ?? {}
  entry.handlers = c.on ?? {}
  entry.onInstall = c.onInstall
  entry.onUninstall = c.onUninstall
  return next
}

const moduleToPlugin = (item: CatalogEntry, order: number): Plugin =>
  definePlugin({
    slug: `renote-module-${item.manifest.id}`,
    order,
    plugin: async ({ config }) => {
      const { manifest } = item
      const entry = register(manifest)
      try {
        const contributions = await withTimeout(
          item.definition.setup({ slug: (name) => collectionSlug(manifest.id, name) as CollectionSlug }),
          SETUP_TIMEOUT_MS,
          'setup',
        )
        const next = applyContributions(config, entry, contributions, item)
        if (isKilled(manifest)) setStatus(manifest.id, 'disabled', 'Модуль отключён Платформой (kill switch)')
        return next
      } catch (err) {
        // Safe mode (ADR-002): ядро поднимается без модуля, конфиг остаётся прежним.
        entry.collections = []
        setStatus(manifest.id, 'failed', `Ошибка запуска: ${(err as Error).message}`)
        return config
      }
    },
  })()

// Общая часть: служебная коллекция, задачи событий, маршруты модулей и
// заглушка 503 для маршрутов модулей, которые сейчас недоступны.
const modulesCorePlugin = definePlugin({
  slug: 'renote-modules-core',
  order: 10_000,
  plugin: ({ config }) => ({
    ...config,
    collections: [...(config.collections ?? []), CellModules],
    endpoints: [
      ...(config.endpoints ?? []),
      ...modulesEndpoints,
      ...(['get', 'post', 'put', 'patch', 'delete'] as const).map((method) => ({
        path: '/m/:moduleId/:rest*',
        method,
        handler: async () => unavailable(),
      })),
    ],
    jobs: { ...config.jobs, tasks: [...(config.jobs?.tasks ?? []), ...eventTasks] },
    onInit: async (payload) => {
      await config.onInit?.(payload)
      await refreshInstalled(payload)
      setInterval(() => {
        refreshInstalled(payload).catch((err) =>
          payload.logger.error({ err }, 'Не удалось обновить список модулей'),
        )
      }, INSTALLED_REFRESH_MS).unref()
    },
  }),
})

export const modulePlugins = (catalog: CatalogEntry[]): Plugin[] => {
  for (const id of [...registry.keys()]) if (!catalog.some((c) => c.manifest.id === id)) registry.delete(id)
  return [...catalog.map((item, i) => moduleToPlugin(item, i)), modulesCorePlugin()]
}
