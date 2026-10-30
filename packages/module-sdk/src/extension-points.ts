// Точки расширения ядра (ADR-003). Список выведен из первых модулей —
// forms, seo, redirects, legal — и фиксируется здесь.

export type SiteInfo = {
  name: string
  // Публичный адрес сайта без слеша в конце: https://example.ru
  url: string
  locale: string
}

// Страница, как её видят фильтры. В fields — только группа полей самого модуля.
export type SitePage = {
  id: number | string
  path: string
  title: string
  updatedAt: string
  fields: Record<string, unknown> | undefined
}

export type PageMeta = {
  title: string
  description: string
  canonical: string
  robots: { index: boolean; follow: boolean }
  openGraph: { title: string; description: string; image?: string; type: 'website' | 'article' }
  jsonLd: Record<string, unknown>[]
}

export type Breadcrumb = { label: string; path: string }

export type SitemapEntry = {
  path: string
  lastmod?: string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
}

export type ExtensionPoints = {
  // Мета-теги страницы: заголовок, описание, canonical, robots, Open Graph, JSON-LD.
  'page.meta': { value: PageMeta; args: { page: SitePage; site: SiteInfo } }
  // Хлебные крошки страницы, от главной к текущей.
  'page.breadcrumbs': { value: Breadcrumb[]; args: { page: SitePage; site: SiteInfo } }
  // Записи sitemap.xml: ядро даёт опубликованные страницы, модули добавляют свои.
  // В pages — страницы сайта с группой полей модуля (например, noindex у SEO).
  'sitemap.entries': { value: SitemapEntry[]; args: { site: SiteInfo; pages: SitePage[] } }
  // Строки robots.txt.
  'site.robots': { value: string[]; args: { site: SiteInfo } }
}

export type ExtensionPoint = keyof ExtensionPoints

// Контекст фильтра — только чтение: свои настройки (один раз на запрос) и свои коллекции.
export type FilterContext = {
  settings: () => Promise<Record<string, unknown>>
  read: (collection: string) => {
    find: (args?: {
      where?: Record<string, unknown>
      limit?: number
      sort?: string
    }) => Promise<(Record<string, unknown> & { id: number | string })[]>
  }
}

export type Filters = {
  [K in ExtensionPoint]?: (
    value: ExtensionPoints[K]['value'],
    args: ExtensionPoints[K]['args'],
    ctx: FilterContext,
  ) => ExtensionPoints[K]['value'] | Promise<ExtensionPoints[K]['value']>
}

// События, которые публикует само ядро. Модули подписываются на них так же,
// как на события других модулей.
export const CORE_EVENTS = {
  // Адрес опубликованной страницы изменился: { pageId, from, to }.
  pagePathChanged: 'page.path-changed.v1',
} as const

export type CoreEvent = (typeof CORE_EVENTS)[keyof typeof CORE_EVENTS]
