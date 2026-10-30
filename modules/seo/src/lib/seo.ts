import type { Breadcrumb, PageMeta, SiteInfo, SitemapEntry, SitePage } from '@renote/module-sdk'

// Чистые функции модуля SEO: без Payload и базы, поэтому легко тестируются.

export type SeoSettings = {
  indexSite?: boolean | null
  titleTemplate?: string | null
  defaultDescription?: string | null
  defaultOgImage?: string | null
  robotsDisallow?: string | null
  robotsExtra?: string | null
  sitemapChangefreq?: SitemapEntry['changefreq'] | null
  breadcrumbsHome?: string | null
}

// Группа полей SEO в странице.
export type SeoFields = {
  title?: string | null
  description?: string | null
  canonical?: string | null
  noindex?: boolean | null
  nofollow?: boolean | null
  ogImage?: { url?: string | null } | number | string | null
  jsonLd?: unknown
}

const DESCRIPTION_LIMIT = 160

const lines = (text?: string | null) =>
  (text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

const absolute = (site: SiteInfo, url: string) => (url.startsWith('http') ? url : `${site.url}${url}`)

// Пока название сайта не задано, шаблон с %site дал бы «Услуги — » — тогда только заголовок.
export const applyTitleTemplate = (template: string | null | undefined, title: string, site: SiteInfo) =>
  !template || (template.includes('%site') && !site.name.trim())
    ? title
    : template.replace('%s', title).replace('%site', site.name).trim()

// Описание обрезается по слову: поисковики показывают ~160 символов.
export const clampDescription = (text: string) => {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= DESCRIPTION_LIMIT) return clean
  const cut = clean.slice(0, DESCRIPTION_LIMIT - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length)}…`
}

export const buildMeta = (
  meta: PageMeta,
  page: SitePage,
  site: SiteInfo,
  settings: SeoSettings,
): PageMeta => {
  const fields = (page.fields ?? {}) as SeoFields
  const indexable = settings.indexSite !== false
  // Свой заголовок страницы используется как есть, иначе — заголовок по шаблону.
  const title = fields.title?.trim() || applyTitleTemplate(settings.titleTemplate, page.title, site)
  const description = clampDescription(fields.description || settings.defaultDescription || meta.description)
  const ogImageUrl =
    (fields.ogImage && typeof fields.ogImage === 'object' ? fields.ogImage.url : undefined) ||
    settings.defaultOgImage ||
    undefined

  const jsonLd = [...meta.jsonLd]
  if (page.path === '/') {
    jsonLd.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: site.url })
  }
  if (fields.jsonLd && typeof fields.jsonLd === 'object')
    jsonLd.push(fields.jsonLd as Record<string, unknown>)

  return {
    ...meta,
    title,
    description,
    canonical: fields.canonical ? absolute(site, fields.canonical) : meta.canonical,
    robots: { index: indexable && !fields.noindex, follow: indexable && !fields.nofollow },
    openGraph: {
      ...meta.openGraph,
      title,
      description,
      image: ogImageUrl ? absolute(site, ogImageUrl) : meta.openGraph.image,
    },
    jsonLd,
  }
}

export const buildRobots = (base: string[], site: SiteInfo, settings: SeoSettings) => {
  if (settings.indexSite === false) return ['User-agent: *', 'Disallow: /']
  const disallow = lines(settings.robotsDisallow).map((path) => `Disallow: ${path}`)
  const extra = lines(settings.robotsExtra)
  return [
    ...base,
    ...disallow,
    ...(extra.length ? ['', ...extra] : []),
    '',
    `Sitemap: ${site.url}/sitemap.xml`,
  ]
}

export const buildSitemap = (entries: SitemapEntry[], pages: SitePage[], settings: SeoSettings) => {
  if (settings.indexSite === false) return []
  const hidden = new Set(pages.filter((p) => (p.fields as SeoFields | undefined)?.noindex).map((p) => p.path))
  return entries
    .filter((e) => !hidden.has(e.path))
    .map((e) => ({
      ...e,
      changefreq: e.changefreq ?? settings.sitemapChangefreq ?? 'weekly',
      // Главная важнее остальных; чем глубже страница, тем ниже приоритет.
      priority: e.priority ?? (e.path === '/' ? 1 : Math.max(3, 8 - (e.path.split('/').length - 2)) / 10),
    }))
}

export const buildBreadcrumbs = (crumbs: Breadcrumb[], settings: SeoSettings): Breadcrumb[] => {
  const home = { label: settings.breadcrumbsHome || 'Главная', path: '/' }
  const rest = crumbs.filter((c) => c.path !== '/')
  return [home, ...rest]
}
