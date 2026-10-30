import type { GlobalConfig } from 'payload'

import { canEdit } from '../access/roles'
import { queueRevalidate, siteTags } from '../site/revalidate'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Настройки сайта',
  admin: { group: 'Система' },
  access: { read: () => true, update: canEdit },
  hooks: { afterChange: [({ doc, req }) => queueRevalidate(req, [siteTags.settings]).then(() => doc)] },
  fields: [
    { name: 'siteName', type: 'text', required: true, localized: true, label: 'Название сайта' },
    { name: 'logo', type: 'upload', relationTo: 'media', label: 'Логотип' },
    {
      name: 'contacts',
      type: 'group',
      label: 'Контакты',
      fields: [
        { name: 'phone', type: 'text', label: 'Телефон' },
        { name: 'email', type: 'email', label: 'Email' },
        { name: 'address', type: 'textarea', localized: true, label: 'Адрес' },
      ],
    },
    {
      name: 'socials',
      type: 'array',
      label: 'Соцсети',
      fields: [
        {
          name: 'network',
          type: 'select',
          label: 'Сеть',
          options: ['telegram', 'vk', 'whatsapp', 'youtube'],
        },
        { name: 'url', type: 'text', label: 'Ссылка' },
      ],
    },
    {
      name: 'requisites',
      type: 'group',
      label: 'Реквизиты',
      fields: [
        { name: 'legalName', type: 'text', label: 'Юр. лицо' },
        { name: 'inn', type: 'text', label: 'ИНН' },
        { name: 'ogrn', type: 'text', label: 'ОГРН' },
      ],
    },
  ],
}
