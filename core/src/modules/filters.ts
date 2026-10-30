import type { ExtensionPoint, ExtensionPoints, FilterContext, SitePage } from '@renote/module-sdk'
import type { GlobalSlug, PayloadRequest } from 'payload'

import { settingsSlug } from './naming'
import { isActive, registry, setStatus } from './registry'
import { createRuntime } from './runtime'

// Бюджет синхронной точки расширения (ADR-002).
export const FILTER_BUDGET_MS = 50

const TIMEOUT = Symbol('timeout')

type Args<K extends ExtensionPoint> = ExtensionPoints[K]['args']

// Страница в аргументах приходит со всеми группами полей модулей (`fields[moduleId]`).
// Каждому модулю отдаём только его собственную группу (ADR-003: чужие данные не читаем).
const ownFields = (moduleId: string, page: SitePage): SitePage => ({
  ...page,
  fields: page.fields?.[moduleId] as Record<string, unknown> | undefined,
})

const argsFor = <K extends ExtensionPoint>(moduleId: string, args: Args<K>): Args<K> => {
  const narrowed = { ...args } as Record<string, unknown>
  if ('page' in args) narrowed.page = ownFields(moduleId, args.page as SitePage)
  if ('pages' in args) narrowed.pages = (args.pages as SitePage[]).map((p) => ownFields(moduleId, p))
  return narrowed as Args<K>
}

// Настройки модуля читаются лениво и один раз на запрос; коллекции — только свои и только чтение.
const contextFor = (moduleId: string, req: PayloadRequest): FilterContext => {
  let cached: Promise<Record<string, unknown>> | undefined
  const entry = registry.get(moduleId)
  return {
    read: (collection) => {
      if (!entry) throw new Error(`Модуль ${moduleId} не найден`)
      const { find } = createRuntime(entry, req).data(collection, { asSystem: true })
      return { find }
    },
    settings: () =>
      (cached ??= registry.get(moduleId)?.manifest.settings
        ? (req.payload.findGlobal({
            slug: settingsSlug(moduleId) as GlobalSlug,
            req,
            overrideAccess: true,
            depth: 0,
          }) as unknown as Promise<Record<string, unknown>>)
        : Promise.resolve({})),
  }
}

// Прогоняет значение через фильтры всех активных модулей по очереди. Ошибка или
// превышение бюджета пропускает вклад модуля и переводит его в degraded, но не ломает запрос.
export const applyFilter = async <K extends ExtensionPoint>(
  name: K,
  value: ExtensionPoints[K]['value'],
  args: Args<K>,
  req: PayloadRequest,
): Promise<ExtensionPoints[K]['value']> => {
  let current = value
  for (const [id, entry] of registry) {
    const handler = entry.filters[name] as
      | ((
          v: ExtensionPoints[K]['value'],
          a: Args<K>,
          ctx: FilterContext,
        ) => ExtensionPoints[K]['value'] | Promise<ExtensionPoints[K]['value']>)
      | undefined
    if (!handler || !isActive(id)) continue

    const started = performance.now()
    let timer: NodeJS.Timeout | undefined
    try {
      const result = await Promise.race([
        Promise.resolve().then(() =>
          handler(structuredClone(current), argsFor(id, args), contextFor(id, req)),
        ),
        new Promise<typeof TIMEOUT>((resolve) => {
          timer = setTimeout(() => resolve(TIMEOUT), FILTER_BUDGET_MS)
        }),
      ])
      const elapsed = Math.round(performance.now() - started)
      if (result === TIMEOUT) {
        setStatus(id, 'degraded', `Фильтр ${name} не уложился в ${FILTER_BUDGET_MS} мс, вклад пропущен`)
      } else if (elapsed > FILTER_BUDGET_MS) {
        // Синхронный код нельзя прервать: он уже отнял время у запроса.
        setStatus(id, 'degraded', `Фильтр ${name} блокировал поток ${elapsed} мс, вклад пропущен`)
      } else {
        current = result
      }
    } catch (e) {
      setStatus(id, 'degraded', `Фильтр ${name} упал: ${(e as Error).message}`)
    } finally {
      clearTimeout(timer)
    }
  }
  return current
}
