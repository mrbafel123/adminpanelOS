// Пространство имён модуля в API и базе (ADR-003, ADR-012).
export const collectionSlug = (moduleId: string, name: string) =>
  name === moduleId ? moduleId : `${moduleId}-${name}`

export const tableName = (moduleId: string, name: string) => `mod_${moduleId}_${name}`.replace(/-/g, '_')

export const settingsSlug = (moduleId: string) => `${moduleId}-settings`

export const blockSlug = (moduleId: string, name: string) => `${moduleId}-${name}`

export const EVENT_DISPATCH_TASK = 'renote-event-dispatch'
export const EVENT_DELIVER_TASK = 'renote-event-deliver'
