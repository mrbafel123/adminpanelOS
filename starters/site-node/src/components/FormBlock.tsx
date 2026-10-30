'use client'

import { createCms, type LegalDocumentSummary } from '@renote/site-sdk'
import type { Form } from '@renote/site-sdk/content'
import React, { useState } from 'react'

// В браузере — только публичный адрес ядра.
const cms = createCms({ url: process.env.NEXT_PUBLIC_CMS_URL ?? 'http://localhost:3200' })

const INPUT_TYPES: Record<string, string> = { email: 'email', phone: 'tel', text: 'text' }

// Форма модуля «Формы». Если на сайте есть обязательные документы (модуль legal),
// перед отправкой фиксируется согласие на обработку персональных данных (152-ФЗ).
export const FormBlock = ({ form, consentDocs }: { form: Form; consentDocs: LegalDocumentSummary[] }) => {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const required = consentDocs.filter((d) => d.required)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setState('sending')
    setErrors({})
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    try {
      if (required.length) {
        if (!data._consent) {
          setErrors({ _consent: 'Нужно согласие на обработку персональных данных' })
          setState('idle')
          return
        }
        // Субъект согласия — первое поле с контактом.
        const contact = (form.fields ?? []).find((f) => f.type === 'email' || f.type === 'phone')
        const consent = await cms.giveConsent({
          subject: (contact && data[contact.name]) || 'анонимно',
          documents: required.map((d) => d.slug),
          source: `forms:${form.id}`,
        })
        if (!consent.ok) throw new Error('Согласие не сохранено')
      }
      const res = await cms.submitForm(form.id, data)
      if (res.status === 422) {
        setErrors((res.data.errors as Record<string, string>) ?? {})
        setState('idle')
        return
      }
      if (!res.ok) throw new Error(res.data.error ?? 'Ошибка')
      setMessage(res.data.message ?? 'Спасибо!')
      setState('done')
    } catch {
      setMessage('Не удалось отправить. Попробуйте позже или позвоните нам.')
      setState('error')
    }
  }

  if (state === 'done') return <section className="section form-done">{message}</section>

  return (
    <section className="section">
      <h2>{form.title}</h2>
      <form className="form" onSubmit={submit} noValidate>
        {(form.fields ?? []).map((f) => (
          <label key={f.name} className={f.type === 'checkbox' ? 'checkbox' : undefined}>
            {f.type === 'checkbox' ? (
              <>
                <input type="checkbox" name={f.name} /> {f.label}
              </>
            ) : (
              <>
                {f.label}
                {f.required && ' *'}
                {f.type === 'textarea' ? (
                  <textarea name={f.name} rows={4} />
                ) : (
                  <input type={INPUT_TYPES[f.type] ?? 'text'} name={f.name} />
                )}
              </>
            )}
            {errors[f.name] && <span className="error">{errors[f.name]}</span>}
          </label>
        ))}
        {required.length > 0 && (
          <label className="checkbox">
            <input type="checkbox" name="_consent" /> Согласен с{' '}
            {required.map((d, i) => (
              <React.Fragment key={d.slug}>
                {i > 0 && ', '}
                <a href={d.path} target="_blank">
                  {d.title}
                </a>
              </React.Fragment>
            ))}
            {errors._consent && <span className="error">{errors._consent}</span>}
          </label>
        )}
        <input type="text" name="_hp" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
        <button className="button" disabled={state === 'sending'}>
          {state === 'sending' ? 'Отправляем…' : 'Отправить'}
        </button>
        {state === 'error' && <p className="error">{message}</p>}
      </form>
    </section>
  )
}
