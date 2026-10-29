import { describe, expect, it } from 'vitest'

import { validateSubmission, type FormField } from '../src/protected'

const fields: FormField[] = [
  { name: 'name', label: 'Имя', type: 'text', required: true },
  { name: 'phone', label: 'Телефон', type: 'phone', required: true },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'agree', label: 'Согласие', type: 'checkbox', required: true },
]

describe('проверка заявки', () => {
  it('принимает корректную заявку и обрезает пробелы', () => {
    const r = validateSubmission(fields, { name: ' Иван ', phone: '+7 900 123-45-67', agree: true })
    expect(r.ok).toBe(true)
    expect(r.data).toEqual({ name: 'Иван', phone: '+7 900 123-45-67', agree: true })
  })

  it('сообщает обо всех обязательных полях сразу', () => {
    const r = validateSubmission(fields, {})
    expect(r.errors).toEqual({
      name: 'Обязательное поле',
      phone: 'Обязательное поле',
      agree: 'Нужно отметить',
    })
  })

  it('проверяет формат телефона и email', () => {
    const r = validateSubmission(fields, { name: 'И', phone: 'abc', email: 'nope', agree: 'on' })
    expect(r.errors).toEqual({ phone: 'Неверный формат', email: 'Неверный формат' })
  })

  it('отмечает спам по скрытому полю', () => {
    expect(validateSubmission(fields, { _hp: 'x' }).isSpam).toBe(true)
  })

  it('не принимает лишние поля и не падает на мусоре', () => {
    expect(validateSubmission(fields, 'строка').ok).toBe(false)
    const r = validateSubmission(fields, { name: 'И', phone: '+79001112233', agree: true, admin: true })
    expect(r.data).not.toHaveProperty('admin')
  })
})
