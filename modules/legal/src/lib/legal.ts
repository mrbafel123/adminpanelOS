import { createHash } from 'node:crypto'

// Чистые функции модуля legal: версия документа и проверка запроса согласия.

export type PublishedDocument = {
  id: number | string
  slug: string
  title: string
  updatedAt: string
  content?: unknown
  required?: boolean | null
}

export type ConsentRequest = { subject?: unknown; documents?: unknown; source?: unknown }

// Адрес документа на сайте. Его же модуль добавляет в sitemap.
export const legalPath = (slug: string) => `/legal/${slug}`

export const SLUG = /^[a-z0-9-]+$/

// Отпечаток текста документа: по нему через годы видно, с какой именно редакцией согласился человек.
export const contentHash = (content: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(content ?? null))
    .digest('hex')
    .slice(0, 16)

// Снимок документа в записи согласия. Правки документа после согласия эту запись не меняют.
export const documentSnapshot = (doc: PublishedDocument) => ({
  slug: doc.slug,
  title: doc.title,
  version: doc.updatedAt,
  hash: contentHash(doc.content),
})

const MAX_SUBJECT = 200

export const validateConsent = (body: ConsentRequest, published: PublishedDocument[]) => {
  const errors: string[] = []
  const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
  if (!subject) errors.push('subject: кто даёт согласие (email, телефон или идентификатор заявки)')
  if (subject.length > MAX_SUBJECT) errors.push('subject: слишком длинный')

  const slugs = Array.isArray(body.documents)
    ? body.documents.filter((s): s is string => typeof s === 'string')
    : []
  if (!slugs.length) errors.push('documents: на какие документы дано согласие')
  const bySlug = new Map(published.map((d) => [d.slug, d]))
  const unknown = slugs.filter((s) => !bySlug.has(s))
  if (unknown.length) errors.push(`documents: не опубликованы ${unknown.join(', ')}`)

  // Согласие без обязательного документа не считается: например, без политики обработки ПДн.
  const missingRequired = published.filter((d) => d.required && !slugs.includes(d.slug)).map((d) => d.slug)
  if (missingRequired.length) errors.push(`documents: нужно согласие и с ${missingRequired.join(', ')}`)

  return {
    ok: errors.length === 0,
    errors,
    subject,
    documents: slugs.map((s) => bySlug.get(s)).filter((d): d is PublishedDocument => !!d),
    source: typeof body.source === 'string' ? body.source.slice(0, 100) : undefined,
  }
}
