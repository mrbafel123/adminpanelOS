// @renote/module-sdk — всё, что видит модуль (ADR-003, ADR-013).
// Модуль не импортирует Payload и ядро напрямую: только этот пакет.
import type { Block, CollectionConfig, CollectionSlug, Field } from 'payload'

export type { ModuleManifest } from './manifest'
export { validateManifest } from './manifest'

// Коллекция модуля задаётся локальным именем. Slug и таблицу назначает ядро:
// slug `<id>-<name>` (или `<id>`, если имя совпадает с id), таблица `mod_<id>_<name>`.
export type ModuleCollection = Omit<CollectionConfig, 'slug' | 'dbName'> & { name: string }

export type ModuleBlock = Omit<Block, 'slug'> & { name: string }

export type ModuleDoc = Record<string, unknown> & { id: number | string }

export type ScopedCollection = {
  create: (data: Record<string, unknown>) => Promise<ModuleDoc>
  find: (args?: { where?: Record<string, unknown>; limit?: number; sort?: string }) => Promise<ModuleDoc[]>
  findByID: (id: number | string) => Promise<ModuleDoc | null>
  update: (id: number | string, data: Record<string, unknown>) => Promise<ModuleDoc>
}

// То, что модуль получает вместо экземпляра Payload.
export type ModuleRuntime = {
  // Только свои коллекции. Чужое имя — исключение до обращения к БД.
  // asSystem — действие от имени модуля (публичная форма), иначе права пользователя запроса.
  data: (name: string, opts?: { asSystem?: boolean }) => ScopedCollection
  settings: () => Promise<Record<string, unknown>>
  // Событие ставится в очередь в той же транзакции, что и данные (outbox, ADR-012).
  publish: (event: string, data: Record<string, unknown>) => Promise<void>
  log: (message: string, extra?: Record<string, unknown>) => void
}

export type ModuleRequest = {
  method: string
  params: Record<string, string>
  query: Record<string, unknown>
  body: unknown
  user: { id: number | string; role?: string } | null
  ip?: string
}

export type ModuleResponse = { status?: number; body: unknown }

export type ModuleEndpoint = {
  // Путь внутри пространства модуля: `/:formId/submit` → `/api/m/<id>/:formId/submit`.
  path: string
  method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  handler: (req: ModuleRequest, rt: ModuleRuntime) => Promise<ModuleResponse>
}

// Фильтр — синхронная точка расширения с бюджетом 50 мс (ADR-002).
// Получает копию значения и возвращает новое; тип значения задаёт точка расширения.
export type FilterHandler<T = unknown> = (value: T, args: Record<string, unknown>) => T | Promise<T>
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- значение у каждой точки своё
type AnyFilter = FilterHandler<any>
// Подписчик события — асинхронный, со своими повторами и DLQ.
export type EventHandler = (data: Record<string, unknown>, rt: ModuleRuntime) => Promise<void>
// Шаги жизненного цикла (ADR-013). Должны быть идемпотентны.
export type LifecycleHook = (rt: ModuleRuntime) => Promise<void>

export type ModuleContributions = {
  collections?: ModuleCollection[]
  blocks?: ModuleBlock[]
  endpoints?: ModuleEndpoint[]
  filters?: Record<string, AnyFilter>
  on?: Record<string, EventHandler>
  onInstall?: LifecycleHook
  onUninstall?: LifecycleHook
}

export type SetupContext = {
  // Полный slug своей коллекции — для связей между коллекциями модуля.
  slug: (name: string) => CollectionSlug
}

// Манифест не дублируется в коде: он лежит в module.yaml и компилируется в каталог.
export type ModuleDefinition = {
  setup: (ctx: SetupContext) => ModuleContributions | Promise<ModuleContributions>
}

export const defineModule = (def: ModuleDefinition): ModuleDefinition => def

export type { Field }
