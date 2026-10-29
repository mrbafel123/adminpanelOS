import type { Field, TaskConfig } from 'payload'

import { EVENT_DELIVER_TASK, EVENT_DISPATCH_TASK } from './naming'
import { isActive, registry } from './registry'
import { createRuntime, queueTask } from './runtime'

const eventFields: Field[] = [
  { name: 'event', type: 'text', required: true },
  { name: 'source', type: 'text', required: true },
  { name: 'data', type: 'json' },
]

type EventInput = { event: string; source: string; data?: Record<string, unknown>; consumer?: string }
type EventTask = TaskConfig<{ input: EventInput; output: object }>

// Actions из ADR-003: событие раздаётся подписчикам асинхронно. У каждого подписчика
// своя задача, свои повторы и своя запись об ошибке — это и есть DLQ.
export const eventTasks: EventTask[] = [
  {
    slug: EVENT_DISPATCH_TASK,
    label: 'Раздача события подписчикам',
    inputSchema: eventFields,
    retries: 3,
    handler: async ({ input, req }) => {
      const { event } = input
      // Неустановленный модуль событие не получает: подписка действует с момента установки.
      const consumers = [...registry.values()].filter((e) => e.handlers[event] && e.installed)
      for (const consumer of consumers) {
        await queueTask(req, EVENT_DELIVER_TASK, { ...input, consumer: consumer.manifest.id })
      }
      return { output: { consumers: consumers.length } }
    },
  },
  {
    slug: EVENT_DELIVER_TASK,
    label: 'Доставка события модулю',
    inputSchema: [...eventFields, { name: 'consumer', type: 'text', required: true }],
    retries: { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
    handler: async ({ input, req }) => {
      const { event, data, consumer = '' } = input
      const entry = registry.get(consumer)
      const handler = entry?.handlers[event]
      if (!entry || !handler || !isActive(consumer)) {
        throw new Error(`Модуль ${consumer} недоступен, событие ${event} подождёт повтора`)
      }
      await handler(data ?? {}, createRuntime(entry, req))
      return { output: {} }
    },
  },
]
