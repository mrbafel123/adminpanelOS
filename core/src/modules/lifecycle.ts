import { createPayloadRequest, type CollectionConfig, type Payload } from 'payload'

import { checkLicense, isWritable } from './license'
import { isActive, registry } from './registry'
import { createRuntime } from './runtime'

// Состояние установки модулей ячейки (ADR-013). Меняется только операциями
// install / uninstall, напрямую через API — нельзя.
export const CellModules: CollectionConfig = {
  slug: 'cell-modules',
  admin: { hidden: true },
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  versions: false,
  fields: [
    { name: 'moduleId', type: 'text', required: true, unique: true, index: true },
    { name: 'installed', type: 'checkbox', defaultValue: false },
    { name: 'installedAt', type: 'date' },
    { name: 'uninstalledAt', type: 'date' },
  ],
}

const HOOK_TIMEOUT_MS = 10_000

export class LifecycleError extends Error {}

// Перечитывает установленные модули. Ядро и worker — разные процессы,
// поэтому каждый держит свою копию и обновляет её периодически.
export const refreshInstalled = async (payload: Payload) => {
  const { docs } = await payload.find({
    collection: 'cell-modules',
    limit: 1000,
    overrideAccess: true,
    depth: 0,
  })
  const installed = new Set(docs.filter((d) => d.installed).map((d) => d.moduleId))
  for (const [id, entry] of registry) entry.installed = installed.has(id)
}

const withTimeout = async (work: Promise<void>, what: string) => {
  let timer: NodeJS.Timeout | undefined
  try {
    await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${what}: нет ответа за ${HOOK_TIMEOUT_MS} мс`)),
          HOOK_TIMEOUT_MS,
        )
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

const saveState = async (payload: Payload, moduleId: string, data: Record<string, unknown>) => {
  const { docs } = await payload.find({
    collection: 'cell-modules',
    where: { moduleId: { equals: moduleId } },
    limit: 1,
    overrideAccess: true,
  })
  if (docs[0])
    await payload.update({ collection: 'cell-modules', id: docs[0].id, data, overrideAccess: true })
  else
    await payload.create({
      collection: 'cell-modules',
      data: { moduleId, ...data } as never,
      overrideAccess: true,
    })
}

export const installModule = async (payload: Payload, moduleId: string) => {
  const entry = registry.get(moduleId)
  if (!entry) throw new LifecycleError(`Модуля ${moduleId} нет в каталоге`)
  if (entry.installed) return entry
  if (entry.status === 'failed' || entry.status === 'disabled') {
    throw new LifecycleError(`Модуль не работает: ${entry.reason ?? entry.status}`)
  }
  if (!isWritable(checkLicense(entry.manifest)))
    throw new LifecycleError('Нет действующей лицензии на модуль')
  const missing = (entry.manifest.requires ?? []).filter((dep) => !registry.get(dep)?.installed)
  if (missing.length) throw new LifecycleError(`Сначала установите: ${missing.join(', ')}`)

  if (entry.onInstall) {
    const req = await createPayloadRequest({ payload })
    await withTimeout(entry.onInstall(createRuntime(entry, req)), 'onInstall')
  }
  await saveState(payload, moduleId, { installed: true, installedAt: new Date().toISOString() })
  entry.installed = true
  return entry
}

// Удаление — выключение: данные остаются (ADR-013).
export const uninstallModule = async (payload: Payload, moduleId: string) => {
  const entry = registry.get(moduleId)
  if (!entry) throw new LifecycleError(`Модуля ${moduleId} нет в каталоге`)
  if (!entry.installed) return entry
  const dependents = [...registry.values()]
    .filter((e) => e.installed && e.manifest.requires?.includes(moduleId))
    .map((e) => e.manifest.id)
  if (dependents.length) throw new LifecycleError(`От модуля зависят: ${dependents.join(', ')}`)

  if (entry.onUninstall && isActive(moduleId)) {
    const req = await createPayloadRequest({ payload })
    // Ошибка в onUninstall не мешает выключить модуль: иначе сломанный модуль не убрать.
    await withTimeout(entry.onUninstall(createRuntime(entry, req)), 'onUninstall').catch((err) =>
      payload.logger.error({ err, module: moduleId }, 'onUninstall завершился с ошибкой'),
    )
  }
  await saveState(payload, moduleId, { installed: false, uninstalledAt: new Date().toISOString() })
  entry.installed = false
  return entry
}
