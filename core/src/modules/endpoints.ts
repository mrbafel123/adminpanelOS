import type { Endpoint, PayloadRequest } from 'payload'

import { checkLicense } from './license'
import { installModule, LifecycleError, uninstallModule } from './lifecycle'
import { registry } from './registry'

export const modulesSnapshot = () =>
  [...registry.values()].map(({ manifest, status, reason, since, installed, incidents }) => ({
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    installed,
    status,
    reason,
    since,
    license: checkLicense(manifest),
    requires: manifest.requires ?? [],
    degradation: manifest.degradation,
    incidents: incidents.slice(0, 5),
  }))

const isOwner = (req: PayloadRequest) => (req.user as { role?: string } | null)?.role === 'owner'

const lifecycleEndpoint = (action: 'install' | 'uninstall'): Endpoint => ({
  path: `/renote/modules/:moduleId/${action}`,
  method: 'post',
  handler: async (req) => {
    if (!isOwner(req)) return Response.json({ error: 'Модулями управляет владелец ячейки' }, { status: 403 })
    const moduleId = String(req.routeParams?.moduleId)
    try {
      const run = action === 'install' ? installModule : uninstallModule
      await run(req.payload, moduleId)
      req.payload.logger.info({ module: moduleId, user: req.user?.id }, `Модуль: ${action}`)
      return Response.json(modulesSnapshot().find((m) => m.id === moduleId))
    } catch (err) {
      if (err instanceof LifecycleError) return Response.json({ error: err.message }, { status: 409 })
      throw err
    }
  },
})

export const modulesEndpoints: Endpoint[] = [
  {
    path: '/renote/modules',
    method: 'get',
    handler: async (req) => {
      if (!req.user) return Response.json({ error: 'Нужен вход' }, { status: 401 })
      return Response.json(modulesSnapshot())
    },
  },
  lifecycleEndpoint('install'),
  lifecycleEndpoint('uninstall'),
]
