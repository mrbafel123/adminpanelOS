import type { PayloadRequest, TaskConfig } from 'payload'

import { env } from '../env'
import { queueTask } from '../modules/runtime'

// Мгновенное обновление сайта после публикации (ADR-005). Ядро не зовёт сайт
// напрямую: ставит задачу в очередь в той же транзакции, worker доставляет её
// с повторами. Сайт недоступен — обновление подождёт, публикация не сломается.

export const REVALIDATE_TASK = 'site-revalidate'

// Теги кеша сайта. Тот же список — в @renote/site-sdk.
export const siteTags = {
  all: 'cms',
  page: (path: string) => `page:${path}`,
  pages: 'pages',
  settings: 'settings',
  // Данные любого модуля влияют на мета-теги и блоки всех страниц.
  modules: 'modules',
  module: (id: string) => `module:${id}`,
}

export const queueRevalidate = async (req: PayloadRequest, tags: (string | undefined | null)[]) => {
  if (!env.siteRevalidateUrl) return
  const unique = [...new Set(tags.filter((t): t is string => !!t))]
  if (unique.length) await queueTask(req, REVALIDATE_TASK, { tags: unique })
}

type RevalidateInput = { tags: string[] }

export const revalidateTask: TaskConfig<{ input: RevalidateInput; output: object }> = {
  slug: REVALIDATE_TASK,
  label: 'Обновление кеша сайта',
  inputSchema: [{ name: 'tags', type: 'json', required: true }],
  retries: { attempts: 6, backoff: { type: 'exponential', delay: 5000 } },
  handler: async ({ input }) => {
    if (!env.siteRevalidateUrl) return { output: { skipped: true } }
    const res = await fetch(env.siteRevalidateUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-renote-secret': env.siteRevalidateSecret },
      body: JSON.stringify({ tags: input.tags }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Сайт ответил ${res.status} на обновление кеша`)
    return { output: { tags: input.tags } }
  },
}
