import { defineModule, type ModuleRuntime } from '@renote/module-sdk'

import { documentSnapshot, legalPath, SLUG, validateConsent, type PublishedDocument } from './lib/legal'

const published = async (rt: Pick<ModuleRuntime, 'data'>) =>
  (await rt.data('documents', { asSystem: true }).find({
    where: { _status: { equals: 'published' } },
    sort: 'order',
    limit: 100,
  })) as unknown as PublishedDocument[]

export default defineModule({
  setup: () => ({
    collections: [
      {
        name: 'documents',
        labels: { singular: 'Документ', plural: 'Документы' },
        admin: { useAsTitle: 'title', defaultColumns: ['title', 'kind', 'required', '_status', 'updatedAt'] },
        // Каждая публикация — новая редакция; история нужна, чтобы показать, с чем соглашались.
        versions: { drafts: true, maxPerDoc: 100 },
        access: {
          read: ({ req }) => (req.user ? true : { _status: { equals: 'published' } }),
        },
        fields: [
          { name: 'title', type: 'text', required: true, localized: true, label: 'Название' },
          {
            name: 'slug',
            type: 'text',
            required: true,
            unique: true,
            label: 'Адрес',
            admin: { position: 'sidebar', description: 'Латиницей: privacy → /legal/privacy' },
            validate: (value: unknown) =>
              typeof value === 'string' && SLUG.test(value) ? true : 'Только латиница, цифры и дефис',
          },
          {
            name: 'kind',
            type: 'select',
            required: true,
            defaultValue: 'privacy',
            label: 'Вид',
            admin: { position: 'sidebar' },
            options: [
              { label: 'Политика обработки персональных данных', value: 'privacy' },
              { label: 'Согласие на обработку персональных данных', value: 'consent' },
              { label: 'Пользовательское соглашение', value: 'terms' },
              { label: 'Политика cookie', value: 'cookies' },
              { label: 'Другое', value: 'other' },
            ],
          },
          {
            name: 'required',
            type: 'checkbox',
            label: 'Согласие обязательно',
            admin: {
              position: 'sidebar',
              description: 'Без согласия с этим документом формы не принимаются',
            },
          },
          {
            name: 'order',
            type: 'number',
            defaultValue: 0,
            label: 'Порядок',
            admin: { position: 'sidebar' },
          },
          { name: 'content', type: 'richText', localized: true, label: 'Текст' },
        ],
      },
      {
        name: 'consents',
        labels: { singular: 'Согласие', plural: 'Журнал согласий' },
        admin: { useAsTitle: 'subject', defaultColumns: ['subject', 'source', 'givenAt'] },
        versions: false,
        // Журнал неизменяем: записи создаёт только сайт через модуль, читает владелец ячейки.
        access: {
          read: ({ req }) => (req.user as { role?: string } | null)?.role === 'owner',
          create: () => false,
          update: () => false,
          delete: () => false,
        },
        fields: [
          { name: 'subject', type: 'text', required: true, index: true, label: 'Кто дал согласие' },
          {
            name: 'documents',
            type: 'array',
            label: 'Документы',
            fields: [
              { name: 'slug', type: 'text', label: 'Адрес' },
              { name: 'title', type: 'text', label: 'Название' },
              { name: 'version', type: 'text', label: 'Редакция от' },
              { name: 'hash', type: 'text', label: 'Отпечаток текста' },
            ],
          },
          { name: 'source', type: 'text', label: 'Где дано', admin: { description: 'Например, forms:1' } },
          { name: 'ip', type: 'text', label: 'IP' },
          {
            name: 'givenAt',
            type: 'date',
            required: true,
            label: 'Когда',
            admin: { date: { pickerAppearance: 'dayAndTime' } },
          },
        ],
      },
    ],

    endpoints: [
      {
        path: '/documents',
        method: 'get',
        handler: async (_req, rt) => ({
          body: (await published(rt)).map(({ slug, title, required, updatedAt }) => ({
            slug,
            title,
            required: !!required,
            updatedAt,
            path: legalPath(slug),
          })),
        }),
      },
      {
        path: '/documents/:slug',
        method: 'get',
        handler: async (req, rt) => {
          const doc = (await published(rt)).find((d) => d.slug === req.params.slug)
          return doc ? { body: doc } : { status: 404, body: { error: 'Документ не найден' } }
        },
      },
      {
        // Сайт фиксирует согласие перед отправкой формы с персональными данными (152-ФЗ).
        path: '/consents',
        method: 'post',
        handler: async (req, rt) => {
          const check = validateConsent((req.body ?? {}) as Record<string, unknown>, await published(rt))
          if (!check.ok) return { status: 422, body: { errors: check.errors } }
          const consent = await rt.data('consents', { asSystem: true }).create({
            subject: check.subject,
            documents: check.documents.map(documentSnapshot),
            source: check.source,
            ip: req.ip,
            givenAt: new Date().toISOString(),
          })
          await rt.publish('legal.consent-given.v1', {
            consentId: consent.id,
            documents: check.documents.map((d) => d.slug),
          })
          return { status: 201, body: { consentId: consent.id } }
        },
      },
    ],

    filters: {
      // Опубликованные документы — в sitemap.
      'sitemap.entries': async (entries, _args, ctx) => {
        const docs = (await ctx.read('documents').find({
          where: { _status: { equals: 'published' } },
          limit: 100,
        })) as unknown as PublishedDocument[]
        return [
          ...entries,
          ...docs.map((d) => ({
            path: legalPath(d.slug),
            lastmod: d.updatedAt,
            changefreq: 'yearly' as const,
            priority: 0.2,
          })),
        ]
      },
    },
  }),
})
