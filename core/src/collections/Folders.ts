import type { CollectionConfig } from 'payload'

import { canEdit, isLoggedIn } from '../access/roles'

export const Folders: CollectionConfig = {
  slug: 'folders',
  labels: { singular: 'Папка', plural: 'Папки' },
  admin: { useAsTitle: 'name', group: 'Контент' },
  access: { read: isLoggedIn, create: canEdit, update: canEdit, delete: canEdit },
  folders: true,
  versions: false,
  fields: [{ name: 'name', type: 'text', required: true, label: 'Название' }],
}
