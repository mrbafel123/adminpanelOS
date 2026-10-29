import type { CollectionConfig } from 'payload'

import { canEdit, publishedOrLoggedIn } from '../access/roles'
import { pageBlocks } from '../blocks'
import { slugField } from '../fields/slug'

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Страница', plural: 'Страницы' },
  admin: { useAsTitle: 'title', group: 'Контент', defaultColumns: ['title', 'slug', '_status', 'updatedAt'] },
  versions: { drafts: { autosave: { interval: 2000 } }, maxPerDoc: 30 },
  access: {
    read: publishedOrLoggedIn,
    create: canEdit,
    update: canEdit,
    delete: canEdit,
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
    slugField(),
  ],
}
