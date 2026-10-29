import type { ModuleDefinition, ModuleManifest } from '@renote/module-sdk'

export type JsonSchema = {
  type?: string
  title?: string
  description?: string
  format?: string
  enum?: string[]
  default?: unknown
  properties?: Record<string, JsonSchema>
  required?: string[]
}

// Запись каталога модулей. Каталог генерируется при сборке (ADR-013).
export type CatalogEntry = {
  manifest: ModuleManifest
  settingsSchema: JsonSchema | null
  definition: ModuleDefinition
}
