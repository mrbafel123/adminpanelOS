import type { Endpoint, Payload } from 'payload'

import { registry } from '../modules/registry'

// Worker пишет пульс раз в 15 с. Три пропуска подряд — считаем, что он не работает.
export const WORKER_HEARTBEAT_MS = 15_000
const WORKER_STALE_MS = WORKER_HEARTBEAT_MS * 3

export type CellHealth = {
  status: 'ready' | 'degraded' | 'down'
  checks: Record<string, { ok: boolean; detail?: string }>
}

// Модель здоровья ADR-002: ready — всё работает, degraded — работает с причиной, down — БД недоступна.
export const checkHealth = async (payload: Payload, now = Date.now()): Promise<CellHealth> => {
  const checks: CellHealth['checks'] = {}

  try {
    await payload.db.drizzle.execute('select 1')
    checks.database = { ok: true }
  } catch (e) {
    checks.database = { ok: false, detail: (e as Error).message }
    return { status: 'down', checks }
  }

  const runtime = await payload.findGlobal({ slug: 'cell-runtime', overrideAccess: true })
  const seenAt = runtime.workerSeenAt ? Date.parse(runtime.workerSeenAt) : undefined
  checks.worker =
    seenAt && now - seenAt < WORKER_STALE_MS
      ? { ok: true }
      : {
          ok: false,
          detail: seenAt
            ? `worker не отвечает ${Math.round((now - seenAt) / 1000)} с, задачи копятся в очереди`
            : 'worker ещё ни разу не запускался',
        }

  // Установленный модуль, который упал или деградировал, — повод для degraded с причиной.
  for (const entry of registry.values()) {
    if (!entry.installed || entry.status === 'active') continue
    checks[`module:${entry.manifest.id}`] = {
      ok: false,
      detail: `${entry.status}: ${entry.reason ?? ''}`.trim(),
    }
  }

  return { status: Object.values(checks).every((c) => c.ok) ? 'ready' : 'degraded', checks }
}

export const healthEndpoint: Endpoint = {
  path: '/renote/health',
  method: 'get',
  handler: async (req) => {
    const health = await checkHealth(req.payload)
    return Response.json(health, { status: health.status === 'down' ? 503 : 200 })
  },
}
