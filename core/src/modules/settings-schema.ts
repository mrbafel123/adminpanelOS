import type { Field } from 'payload'

import type { JsonSchema } from './types'

// Форма настроек модуля строится из JSON Schema (ADR-003, «UI из схемы»).
export const schemaToFields = (schema: JsonSchema): Field[] =>
  Object.entries(schema.properties ?? {}).map(([name, prop]): Field => {
    const common = {
      name,
      label: prop.title ?? name,
      required: schema.required?.includes(name),
      admin: prop.description ? { description: prop.description } : undefined,
      defaultValue: prop.default as never,
    }
    if (prop.enum) return { ...common, type: 'select', options: prop.enum }
    switch (prop.type) {
      case 'boolean':
        return { ...common, type: 'checkbox' }
      case 'number':
      case 'integer':
        return { ...common, type: 'number' }
      case 'object':
        return { ...common, type: 'group', fields: schemaToFields(prop) } as Field
      default:
        return prop.format === 'email' ? { ...common, type: 'email' } : { ...common, type: 'text' }
    }
  })
