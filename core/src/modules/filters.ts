import { isActive, registry, setStatus } from './registry'

// Бюджет синхронной точки расширения (ADR-002).
export const FILTER_BUDGET_MS = 50

const TIMEOUT = Symbol('timeout')

// Прогоняет значение через фильтры всех модулей. Ошибка или превышение бюджета
// пропускает вклад модуля и переводит его в degraded, но не ломает запрос.
export const applyFilter = async <T>(name: string, value: T, args: Record<string, unknown> = {}) => {
  let current = value
  for (const [id, entry] of registry) {
    const handler = entry.filters[name]
    if (!handler || !isActive(id)) continue

    const started = performance.now()
    let timer: NodeJS.Timeout | undefined
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => handler(structuredClone(current), args)),
        new Promise<typeof TIMEOUT>((resolve) => {
          timer = setTimeout(() => resolve(TIMEOUT), FILTER_BUDGET_MS)
        }),
      ])
      const elapsed = Math.round(performance.now() - started)
      if (result === TIMEOUT) {
        setStatus(id, 'degraded', `Фильтр ${name} не уложился в ${FILTER_BUDGET_MS} мс, вклад пропущен`)
      } else if (elapsed > FILTER_BUDGET_MS) {
        // Синхронный код нельзя прервать: он уже отнял время у запроса.
        setStatus(id, 'degraded', `Фильтр ${name} блокировал поток ${elapsed} мс, вклад пропущен`)
      } else {
        current = result as T
      }
    } catch (e) {
      setStatus(id, 'degraded', `Фильтр ${name} упал: ${(e as Error).message}`)
    } finally {
      clearTimeout(timer)
    }
  }
  return current
}
