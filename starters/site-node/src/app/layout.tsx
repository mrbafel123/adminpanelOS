import type { Metadata } from 'next'
import React from 'react'

import { cms } from '@/cms'
import './globals.css'

export const metadata: Metadata = { title: { default: 'Сайт', template: '%s' } }

// Шапка и подвал не критичны: если ядро недоступно, сайт показывает страницу без них.
const load = async () => {
  try {
    const [settings, menu, docs] = await Promise.all([cms.settings(), cms.menu(), cms.legalDocuments()])
    return { settings, menu, docs }
  } catch {
    return { settings: null, menu: [], docs: [] }
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { settings, menu, docs } = await load()
  return (
    <html lang="ru">
      <body>
        <header className="header">
          <a href="/" className="brand">
            {settings?.siteName || 'Сайт'}
          </a>
          <nav>
            {menu.map((item) => (
              <a key={item.path} href={item.path}>
                {item.title}
              </a>
            ))}
          </nav>
        </header>
        {children}
        <footer className="footer">
          {settings?.contacts?.phone && (
            <a href={`tel:${settings.contacts.phone}`}>{settings.contacts.phone}</a>
          )}
          {settings?.contacts?.email && (
            <a href={`mailto:${settings.contacts.email}`}>{settings.contacts.email}</a>
          )}
          {docs.map((d) => (
            <a key={d.slug} href={d.path}>
              {d.title}
            </a>
          ))}
        </footer>
      </body>
    </html>
  )
}
