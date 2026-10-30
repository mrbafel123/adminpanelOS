import { describe, expect, it } from 'vitest'

import { contentHash, documentSnapshot, validateConsent, type PublishedDocument } from '../src/lib/legal'

const docs: PublishedDocument[] = [
  {
    id: 1,
    slug: 'privacy',
    title: 'Политика',
    updatedAt: '2026-10-01T00:00:00.000Z',
    required: true,
    content: { a: 1 },
  },
  { id: 2, slug: 'marketing', title: 'Рассылки', updatedAt: '2026-10-02T00:00:00.000Z', required: false },
]

describe('согласия', () => {
  it('принимает согласие с обязательным документом', () => {
    const r = validateConsent({ subject: ' +79001234567 ', documents: ['privacy'], source: 'forms:1' }, docs)
    expect(r.ok).toBe(true)
    expect(r.subject).toBe('+79001234567')
    expect(r.documents.map((d) => d.slug)).toEqual(['privacy'])
  })

  it('без обязательного документа согласие не принимается', () => {
    const r = validateConsent({ subject: 'a@b.ru', documents: ['marketing'] }, docs)
    expect(r.ok).toBe(false)
    expect(r.errors).toContainEqual(expect.stringContaining('privacy'))
  })

  it('неопубликованные документы и пустой субъект — ошибки', () => {
    const r = validateConsent({ subject: '', documents: ['privacy', 'secret'] }, docs)
    expect(r.errors).toEqual([
      'subject: кто даёт согласие (email, телефон или идентификатор заявки)',
      'documents: не опубликованы secret',
    ])
  })
})

describe('редакция документа', () => {
  it('снимок хранит дату редакции и отпечаток текста', () => {
    expect(documentSnapshot(docs[0]!)).toEqual({
      slug: 'privacy',
      title: 'Политика',
      version: '2026-10-01T00:00:00.000Z',
      hash: contentHash({ a: 1 }),
    })
  })

  it('любая правка текста меняет отпечаток', () => {
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }))
    expect(contentHash({ a: 1 })).toHaveLength(16)
  })
})
