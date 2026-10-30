import pg from 'pg'
import { createPayloadRequest, type Payload } from 'payload'

// Вызов маршрута без HTTP: тот же обработчик, что и у настоящего запроса.
export const callEndpoint = async (
  payload: Payload,
  method: string,
  urlPath: string,
  { body, query, user }: { body?: unknown; query?: Record<string, string>; user?: unknown } = {},
) => {
  const endpoint = payload.config.endpoints.find((e) => {
    if (e.method !== method) return false
    const pattern = new RegExp(`^${e.path.replace(/:\w+\*/g, '.*').replace(/:\w+/g, '[^/]+')}$`)
    return pattern.test(urlPath)
  })
  if (!endpoint) throw new Error(`Нет маршрута ${method} ${urlPath}`)
  const names = [...endpoint.path.matchAll(/:(\w+)/g)].map((m) => m[1])
  const values = urlPath.split('/').filter((_, i) => endpoint.path.split('/')[i]?.startsWith(':'))
  const req = await createPayloadRequest({ payload, user: (user as never) ?? null })
  req.routeParams = Object.fromEntries(names.map((n, i) => [n, values[i]]))
  req.query = query ?? {}
  req.data = body as Record<string, unknown>
  req.headers = new Headers()
  const res = await endpoint.handler(req)
  const text = await res.text()
  let json: unknown = text
  try {
    json = JSON.parse(text)
  } catch {
    // robots.txt и другие текстовые ответы
  }
  // Ответы маршрутов разные, тесты проверяют их по месту.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, body: json as any }
}

// Раздача и доставка события — две задачи: два прохода очереди, как два тика worker.
export const runQueue = async (payload: Payload) => {
  await payload.jobs.run({ allQueues: true, overrideAccess: true })
  await payload.jobs.run({ allQueues: true, overrideAccess: true })
}

// Каждый файл тестов начинает с пустой базы. Иначе push схемы при другом наборе модулей
// упирается в вопрос Drizzle об удалении таблиц и ждёт ответа, которого в CI нет.
export const resetDatabase = async (connectionString = process.env.TEST_DATABASE_URL) => {
  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    await client.query('drop schema if exists public cascade; create schema public;')
  } finally {
    await client.end()
  }
}
