import type { GlobalConfig } from 'payload'

// Служебное состояние процессов ячейки. Пишет только worker (overrideAccess),
// читает health. В админке не показывается, версий нет: запись каждые 15 с.
export const CellRuntime: GlobalConfig = {
  slug: 'cell-runtime',
  admin: { hidden: true },
  access: { read: () => false, update: () => false },
  versions: false,
  fields: [
    { name: 'workerSeenAt', type: 'date' },
    { name: 'workerStartedAt', type: 'date' },
    { name: 'workerVersion', type: 'text' },
  ],
}
