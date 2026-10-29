import type { CollectionConfig } from 'payload'

import { isOwner, isOwnerField, ROLES } from '../access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Пользователь', plural: 'Пользователи' },
  admin: {
    useAsTitle: 'email',
    group: 'Система',
  },
  auth: true,
  versions: false,
  hooks: {
    // Первый пользователь ячейки — её владелец, иначе управлять ячейкой будет некому.
    beforeChange: [
      async ({ req, operation, data }) => {
        if (operation !== 'create') return data
        const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true, req })
        return totalDocs === 0 ? { ...data, role: 'owner' } : data
      },
    ],
  },
  access: {
    // Себя видит каждый, остальных — только владелец.
    read: ({ req }) => (req.user?.role === 'owner' ? true : { id: { equals: req.user?.id } }),
    create: isOwner,
    delete: isOwner,
  },
  fields: [
    { name: 'name', type: 'text', label: 'Имя' },
    {
      name: 'role',
      type: 'select',
      label: 'Роль',
      required: true,
      defaultValue: 'editor',
      options: [
        { label: 'Владелец', value: ROLES[0] },
        { label: 'Редактор', value: ROLES[1] },
        { label: 'Наблюдатель', value: ROLES[2] },
      ],
      access: { update: isOwnerField },
      saveToJWT: true,
    },
  ],
}
