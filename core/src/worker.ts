// Worker ячейки: отдельный процесс очереди задач (ADR-002, ADR-012).
// В веб-процессе Payload запускает очередь только с первым REST-запросом,
// поэтому задачи выполняются здесь, а веб-процесс только ставит их в очередь.
import { Cron } from 'croner'
import { getPayload } from 'payload'

import { WORKER_HEARTBEAT_MS } from './health'
import config from './payload.config'

const QUEUE_CRON = process.env.WORKER_CRON ?? '*/5 * * * * *'
const BATCH_LIMIT = 20

const payload = await getPayload({ config })
const startedAt = new Date().toISOString()

const beat = () =>
  payload.updateGlobal({
    slug: 'cell-runtime',
    data: {
      workerSeenAt: new Date().toISOString(),
      workerStartedAt: startedAt,
      workerVersion: process.env.CELL_VERSION ?? 'dev',
    },
    overrideAccess: true,
  })

await beat()
const heartbeat = setInterval(() => {
  beat().catch((err) => payload.logger.error({ err }, 'Пульс worker не записан'))
}, WORKER_HEARTBEAT_MS)

// protect: следующий тик не стартует, пока не закончился предыдущий.
const queue = new Cron(QUEUE_CRON, { protect: true }, async () => {
  if (!payload.config.jobs.enabled) return
  try {
    await payload.jobs.handleSchedules({ allQueues: true })
    await payload.jobs.run({ allQueues: true, limit: BATCH_LIMIT, overrideAccess: true, silent: true })
  } catch (err) {
    payload.logger.error({ err }, 'Ошибка цикла очереди')
  }
})

payload.logger.info(`Worker запущен, очередь: ${QUEUE_CRON}`)

// Мягкая остановка: новые задачи не берём, текущую дожидаемся.
const shutdown = async (signal: string) => {
  payload.logger.info(`Worker останавливается (${signal})`)
  queue.stop()
  clearInterval(heartbeat)
  while (queue.isBusy()) await new Promise((resolve) => setTimeout(resolve, 200))
  await payload.destroy()
  process.exit(0)
}
process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))
