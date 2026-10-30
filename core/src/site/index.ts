import type { Breadcrumb, PageMeta, SiteInfo, SitemapEntry, SitePage } from '@renote/module-sdk'
import type { Endpoint, PayloadRequest } from 'payload'

import { env } from '../env'
import { applyFilter } from '../modules/filters'
import { isActive, registry } from '../modules/registry'
import type { Page } from '../payload-types'

// Данные для сайта клиента (ADR-005). Всё, что сайт показывает о странице,
// проходит через точки расширения модулей.

const siteInfo = async (req: PayloadRequest): Promise<SiteInfo> => {
  const settings = await req.payload.findGlobal({
    slug: 'site-settings',
    depth: 0,
    req,
    overrideAccess: true,
  })
  return { name: settings.siteName ?? '', url: env.siteUrl, locale: req.locale ?? 'ru' }
}

const MAX_DEPTH = 10

// Цепочка родителей от главной к странице — основа хлебных крошек.
const ancestors = async (req: PayloadRequest, page: Page) => {
  const chain: Page[] = []
  let parentRef = page.parent
  for (let i = 0; parentRef && i < MAX_DEPTH; i++) {
    const id = typeof parentRef === 'object' ? parentRef.id : parentRef
    const parent = await req.payload.findByID({ collection: 'pages', id, depth: 0, req, disableErrors: true })
    if (!parent) break
    chain.unshift(parent)
    parentRef = parent.parent
  }
  return chain
}

// Группы полей модулей лежат в документе под именем модуля.
const moduleFields = (page: Page) =>
  Object.fromEntries(
    [...registry.keys()]
      .map((id) => [id, (page as unknown as Record<string, unknown>)[id]] as const)
      .filter(([, v]) => v),
  ) as Record<string, unknown>

// Блоки и поля неустановленных модулей сайту не отдаём: данные сохранены, но модуль выключен.
const visibleToSite = (page: Page): Page => {
  const inactive = [...registry.keys()].filter((id) => !isActive(id))
  const clean = { ...page } as Record<string, unknown>
  for (const id of registry.keys()) delete clean[id]
  clean.layout = (page.layout ?? []).filter(
    (block) => !inactive.some((id) => block.blockType.startsWith(`${id}-`)),
  )
  return clean as unknown as Page
}

const toSitePage = (page: Page): SitePage & { fields: Record<string, unknown> } => ({
  id: page.id,
  path: page.path ?? '/',
  title: page.title,
  updatedAt: page.updatedAt,
  fields: moduleFields(page),
})

export const defaultMeta = (page: SitePage, site: SiteInfo): PageMeta => ({
  title: page.title,
  description: '',
  canonical: `${site.url}${page.path === '/' ? '' : page.path}`,
  robots: { index: true, follow: true },
  openGraph: { title: page.title, description: '', type: 'website' },
  jsonLd: [],
})

export const DEFAULT_ROBOTS = ['User-agent: *', 'Disallow: /admin', 'Disallow: /api']

export const siteEndpoints: Endpoint[] = [
  {
    path: '/renote/site/page',
    method: 'get',
    handler: async (req) => {
      const path = typeof req.query?.path === 'string' ? req.query.path : '/'
      const { docs } = await req.payload.find({
        collection: 'pages',
        where: { path: { equals: path }, _status: { equals: 'published' } },
        depth: 1,
        limit: 1,
        req,
        overrideAccess: false,
      })
      const page = docs[0]
      if (!page) return Response.json({ error: 'Страница не найдена' }, { status: 404 })

      const site = await siteInfo(req)
      const sitePage = toSitePage(page)
      const crumbs: Breadcrumb[] = [...(await ancestors(req, page)), page]
        .filter((p) => p.path !== '/' || p.id === page.id)
        .map((p) => ({ label: p.title, path: p.path ?? '/' }))

      const [meta, breadcrumbs] = await Promise.all([
        applyFilter('page.meta', defaultMeta(sitePage, site), { page: sitePage, site }, req),
        applyFilter('page.breadcrumbs', crumbs, { page: sitePage, site }, req),
      ])
      return Response.json({ page: visibleToSite(page), meta, breadcrumbs })
    },
  },
  {
    path: '/renote/site/sitemap',
    method: 'get',
    handler: async (req) => {
      const { docs } = await req.payload.find({
        collection: 'pages',
        where: { _status: { equals: 'published' } },
        depth: 0,
        limit: 5000,
        pagination: false,
        req,
        overrideAccess: false,
      })
      const entries: SitemapEntry[] = docs.map((p) => ({ path: p.path ?? '/', lastmod: p.updatedAt }))
      const site = await siteInfo(req)
      const pages = docs.map(toSitePage)
      return Response.json({
        site,
        entries: await applyFilter('sitemap.entries', entries, { site, pages }, req),
      })
    },
  },
  {
    path: '/renote/site/robots',
    method: 'get',
    handler: async (req) => {
      const site = await siteInfo(req)
      const lines = await applyFilter('site.robots', [...DEFAULT_ROBOTS], { site }, req)
      return new Response(`${lines.join('\n')}\n`, {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    },
  },
]
