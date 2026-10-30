import { CORE_EVENTS } from '@renote/module-sdk'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionConfig,
} from 'payload'

import { canEdit, publishedOrLoggedIn } from '../access/roles'
import { pageBlocks } from '../blocks'
import { slugField } from '../fields/slug'
import { EVENT_DISPATCH_TASK } from '../modules/naming'
import { queueTask } from '../modules/runtime'
import { queueRevalidate, siteTags } from '../site/revalidate'

// Главная страница сайта — страница со slug `home` без родителя.
export const HOME_SLUG = 'home'

type PageRef = number | string | { id: number | string } | null | undefined
const refId = (ref: PageRef) => (ref && typeof ref === 'object' ? ref.id : ref)

// Адрес страницы на сайте складывается из slug родителей: /uslugi/razrabotka.
const computePath: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const slug = (data.slug ?? originalDoc?.slug) as string | undefined
  const parentId = refId((data.parent === undefined ? originalDoc?.parent : data.parent) as PageRef)
  if (!slug) return data
  if (!parentId) return { ...data, path: slug === HOME_SLUG ? '/' : `/${slug}` }

  const parent = await req.payload.findByID({
    collection: 'pages',
    id: parentId,
    depth: 0,
    draft: false,
    overrideAccess: true,
    req,
    disableErrors: true,
  })
  const base = parent?.path && parent.path !== '/' ? parent.path : ''
  return { ...data, path: `${base}/${slug}` }
}

// При смене адреса: пересчитать адреса дочерних страниц и сообщить модулям
// (модуль redirects создаст 301 со старого адреса).
const onPathChange: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  if (operation !== 'update' || !previousDoc?.path || previousDoc.path === doc.path) return doc

  const children = await req.payload.find({
    collection: 'pages',
    where: { parent: { equals: doc.id } },
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    req,
  })
  for (const child of children.docs) {
    await req.payload.update({ collection: 'pages', id: child.id, data: {}, overrideAccess: true, req })
  }

  if (doc._status === 'published' && previousDoc._status === 'published') {
    // В той же транзакции, что и сохранение страницы (outbox, ADR-012).
    await queueTask(req, EVENT_DISPATCH_TASK, {
      event: CORE_EVENTS.pagePathChanged,
      source: 'core',
      data: { pageId: doc.id, from: previousDoc.path, to: doc.path },
    })
  }
  return doc
}

// Сайт обновляет страницу сразу после публикации, снятия с публикации или смены адреса.
// Черновики и автосохранение сайт не трогают.
const revalidateSite: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const visibleNow = doc._status === 'published'
  const visibleBefore = previousDoc?._status === 'published'
  if (!visibleNow && visibleBefore) {
    // Черновик опубликованной страницы или снятие с публикации? Сайт видит только
    // опубликованную версию: если она на месте, это просто черновик.
    const live = await req.payload.findByID({
      collection: 'pages',
      id: doc.id,
      draft: false,
      depth: 0,
      overrideAccess: true,
      req,
      disableErrors: true,
    })
    if (live?._status === 'published') return doc
  }
  if (visibleNow || visibleBefore) {
    await queueRevalidate(req, [
      siteTags.page(doc.path),
      previousDoc?.path && previousDoc.path !== doc.path ? siteTags.page(previousDoc.path) : null,
      siteTags.pages,
    ])
  }
  return doc
}

const revalidateDeleted: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await queueRevalidate(req, [siteTags.page(doc.path), siteTags.pages])
  return doc
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Страница', plural: 'Страницы' },
  admin: { useAsTitle: 'title', group: 'Контент', defaultColumns: ['title', 'path', '_status', 'updatedAt'] },
  versions: { drafts: { autosave: { interval: 2000 } }, maxPerDoc: 30 },
  access: {
    read: publishedOrLoggedIn,
    create: canEdit,
    update: canEdit,
    delete: canEdit,
  },
  // Сюда модули добавляют свои группы полей (например, SEO).
  custom: { renoteFields: true },
  hooks: {
    beforeChange: [computePath],
    afterChange: [onPathChange, revalidateSite],
    afterDelete: [revalidateDeleted],
  },
  fields: [
    { name: 'title', type: 'text', required: true, localized: true, label: 'Заголовок' },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'pages',
      label: 'Родитель',
      admin: { position: 'sidebar' },
    },
    {
      name: 'layout',
      type: 'blocks',
      label: 'Секции',
      labels: { singular: 'секцию', plural: 'Секции' },
      blocks: pageBlocks,
      // Сюда модули и сайт клиента добавляют свои блоки.
      custom: { renoteBlocks: true },
    },
    slugField('title', { unique: false }),
    {
      name: 'path',
      type: 'text',
      label: 'Адрес на сайте',
      unique: true,
      index: true,
      admin: { position: 'sidebar', readOnly: true, description: 'Считается из адресов родителей' },
    },
  ],
}
