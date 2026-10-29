import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import { checkHealth, WORKER_HEARTBEAT_MS } from '../src/health'

const NOW = Date.parse('2026-10-29T12:00:00Z')

const fakePayload = ({ dbDown = false, workerSeenAt }: { dbDown?: boolean; workerSeenAt?: number }) =>
  ({
    db: {
      drizzle: {
        execute: async () => {
          if (dbDown) throw new Error('connection refused')
        },
      },
    },
    findGlobal: async () => ({ workerSeenAt: workerSeenAt ? new Date(workerSeenAt).toISOString() : null }),
  }) as unknown as Payload

describe('здоровье ячейки', () => {
  it('ready, когда БД доступна и worker недавно писал пульс', async () => {
    const health = await checkHealth(fakePayload({ workerSeenAt: NOW - WORKER_HEARTBEAT_MS }), NOW)
    expect(health.status).toBe('ready')
  })

  it('degraded с причиной, когда worker молчит', async () => {
    const health = await checkHealth(fakePayload({ workerSeenAt: NOW - 120_000 }), NOW)
    expect(health.status).toBe('degraded')
    expect(health.checks.worker?.detail).toContain('120 с')
  })

  it('degraded, когда worker ни разу не запускался', async () => {
    const health = await checkHealth(fakePayload({}), NOW)
    expect(health.status).toBe('degraded')
    expect(health.checks.worker?.detail).toContain('ни разу')
  })

  it('down, когда БД недоступна', async () => {
    const health = await checkHealth(fakePayload({ dbDown: true }), NOW)
    expect(health.status).toBe('down')
  })
})
