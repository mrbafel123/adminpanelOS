import { createCms } from '@renote/site-sdk'

// Ядро ячейки. CMS_URL — адрес для сервера сайта, NEXT_PUBLIC_CMS_URL — для браузера.
export const cms = createCms({
  url: process.env.CMS_URL ?? 'http://localhost:3200',
  publicUrl: process.env.NEXT_PUBLIC_CMS_URL ?? process.env.CMS_URL ?? 'http://localhost:3200',
})

export const isStatic = process.env.SITE_MODE === 'static'
