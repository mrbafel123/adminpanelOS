import type { ModuleDoc, ModuleRuntime } from '@renote/module-sdk'
import type { CollectionSlug, GlobalSlug, PayloadRequest } from 'payload'

import { collectionSlug, EVENT_DISPATCH_TASK, settingsSlug } from './naming'
import type { ModuleEntry } from './registry'

// Слаги задач ядра не попадают в сгенерированные типы задач.
export const queueTask = (req: PayloadRequest, task: string, input: Record<string, unknown>) =>
  req.payload.jobs.queue({ task, input, req, overrideAccess: true } as never)

// То, что модуль получает вместо экземпляра Payload: свои коллекции, свои настройки, свои события.
export const createRuntime = (entry: ModuleEntry, req: PayloadRequest): ModuleRuntime => {
  const { id } = entry.manifest
  const payload = req.payload

  return {
    data: (name, { asSystem = false } = {}) => {
      const slug = collectionSlug(id, name)
      if (!entry.collections.includes(slug)) throw new Error(`Модуль ${id} не владеет коллекцией "${name}"`)
      const base = { collection: slug as CollectionSlug, req, overrideAccess: asSystem, depth: 0 }
      return {
        create: async (data) =>
          (await payload.create({ ...base, data: data as never })) as unknown as ModuleDoc,
        find: async ({ where, limit = 100, sort } = {}) =>
          (await payload.find({ ...base, where: where as never, limit, sort }))
            .docs as unknown as ModuleDoc[],
        findByID: async (docId) =>
          (await payload.findByID({
            ...base,
            id: docId,
            disableErrors: true,
          })) as unknown as ModuleDoc | null,
        update: async (docId, data) =>
          (await payload.update({ ...base, id: docId, data: data as never })) as unknown as ModuleDoc,
      }
    },
    settings: async () =>
      entry.manifest.settings
        ? ((await payload.findGlobal({
            slug: settingsSlug(id) as GlobalSlug,
            req,
            overrideAccess: true,
          })) as unknown as Record<string, unknown>)
        : {},
    publish: async (event, data) => {
      if (!entry.manifest.events?.emits?.includes(event)) {
        throw new Error(`Модуль ${id} не объявил событие ${event} в манифесте`)
      }
      // Задача пишется в payload-jobs через тот же req — в той же транзакции, что и данные.
      await queueTask(req, EVENT_DISPATCH_TASK, { event, source: id, data })
    },
    log: (message, extra) => payload.logger.info({ module: id, ...extra }, message),
  }
}
