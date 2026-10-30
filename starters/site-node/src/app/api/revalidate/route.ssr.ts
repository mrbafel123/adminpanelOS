import { pathsToWarm, revalidateHandler } from '@renote/site-sdk'
import { revalidateTag } from 'next/cache'
import { after } from 'next/server'

const self = `http://127.0.0.1:${process.env.PORT ?? 3000}`

// Ядро сообщает, какие данные изменились (только режим ssr). Изменённые страницы
// прогреваются после ответа: первый запрос запускает их пересборку в фоне.
export const POST = revalidateHandler({
  secret: process.env.SITE_REVALIDATE_SECRET,
  revalidateTag,
  onRevalidated: (tags) =>
    after(async () => {
      for (const path of pathsToWarm(tags)) {
        await fetch(`${self}${path}`, { signal: AbortSignal.timeout(10_000) }).catch(() => undefined)
      }
    }),
})
