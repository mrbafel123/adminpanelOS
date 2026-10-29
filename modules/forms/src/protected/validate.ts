// Ценная логика модуля (ADR-009): при передаче проекта собирается с защитой.

export type FormField = { name: string; label: string; type: string; required?: boolean }

const PATTERNS: Record<string, RegExp> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s()-]{7,20}$/,
}

export const validateSubmission = (fields: FormField[], input: unknown) => {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const errors: Record<string, string> = {}
  const data: Record<string, string | boolean> = {}

  for (const field of fields) {
    const raw = body[field.name]
    if (field.type === 'checkbox') {
      data[field.name] = raw === true || raw === 'on'
      if (field.required && !data[field.name]) errors[field.name] = 'Нужно отметить'
      continue
    }
    const value = typeof raw === 'string' ? raw.trim().slice(0, 5000) : ''
    if (!value) {
      if (field.required) errors[field.name] = 'Обязательное поле'
      continue
    }
    const pattern = PATTERNS[field.type]
    if (pattern && !pattern.test(value)) {
      errors[field.name] = 'Неверный формат'
      continue
    }
    data[field.name] = value
  }

  // Honeypot: скрытое поле, которое заполняют только боты.
  const isSpam = typeof body._hp === 'string' && body._hp.length > 0
  return { ok: Object.keys(errors).length === 0, errors, data, isSpam }
}
