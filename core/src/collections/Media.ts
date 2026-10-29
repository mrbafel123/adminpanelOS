import type { CollectionConfig } from 'payload'
import { createFolderField } from 'payload'

import { canEdit } from '../access/roles'

// Файлы хранятся в S3-хранилище ячейки (MinIO), а не на диске контейнера:
// ядро остаётся без состояния, бэкап медиа — это бэкап бакета (ADR-006).
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Файл', plural: 'Медиа' },
  admin: { group: 'Контент' },
  access: {
    read: () => true,
    create: canEdit,
    update: canEdit,
    delete: canEdit,
  },
  fields: [
    { name: 'alt', type: 'text', label: 'Альтернативный текст', localized: true },
    { name: 'caption', type: 'text', label: 'Подпись', localized: true },
    createFolderField({ relationTo: 'folders' }),
  ],
  upload: true,
}
