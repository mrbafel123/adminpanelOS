import type { EventHandler, LifecycleHook, ModuleContributions, ModuleManifest } from '@renote/module-sdk'

// Работоспособность кода модуля (ADR-002). disabled — kill switch.
// Установлен ли модуль — отдельное измерение (installed), лицензия — третье.
export type ModuleStatus = 'active' | 'degraded' | 'failed' | 'disabled'

export type ModuleEntry = {
  manifest: ModuleManifest
  status: ModuleStatus
  reason?: string
  since: string
  installed: boolean
  collections: string[]
  filters: NonNullable<ModuleContributions['filters']>
  handlers: Record<string, EventHandler>
  onInstall?: LifecycleHook
  onUninstall?: LifecycleHook
  incidents: { at: string; message: string }[]
}

type Registry = Map<string, ModuleEntry>

// Общий для всех запросов процесса и переживает hot reload в dev.
const g = globalThis as typeof globalThis & { __renoteModules?: Registry }
export const registry: Registry = (g.__renoteModules ??= new Map())

const now = () => new Date().toISOString()
const MAX_INCIDENTS = 20

export const register = (manifest: ModuleManifest): ModuleEntry => {
  const previous = registry.get(manifest.id)
  const entry: ModuleEntry = {
    manifest,
    status: 'active',
    since: now(),
    // Состояние установки читается из БД; до чтения сохраняем последнее известное.
    installed: previous?.installed ?? false,
    collections: [],
    filters: {},
    handlers: {},
    incidents: [],
  }
  registry.set(manifest.id, entry)
  return entry
}

export const setStatus = (id: string, status: ModuleStatus, reason?: string) => {
  const entry = registry.get(id)
  if (!entry) return
  if (entry.status !== status) entry.since = now()
  entry.status = status
  entry.reason = reason
  if (reason) {
    entry.incidents.unshift({ at: now(), message: reason })
    entry.incidents.length = Math.min(entry.incidents.length, MAX_INCIDENTS)
  }
  if (status !== 'active') console.warn(`[modules] ${id}: ${status}${reason ? ` — ${reason}` : ''}`)
}

// Код модуля можно вызывать: он установлен, запустился и не выключен Платформой.
export const isActive = (id: string) => {
  const entry = registry.get(id)
  return !!entry && entry.installed && (entry.status === 'active' || entry.status === 'degraded')
}
