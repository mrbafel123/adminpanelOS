import type { PageMeta, SiteInfo, SitePage } from '@renote/module-sdk'
import { describe, expect, it } from 'vitest'

import {
  applyTitleTemplate,
  buildBreadcrumbs,
  buildMeta,
  buildRobots,
  buildSitemap,
  clampDescription,
} from '../src/lib/seo'

const site: SiteInfo = { name: 'Renote', url: 'https://renote.ru', locale: 'ru' }
const page = (path: string, fields: Record<string, unknown> = {}): SitePage => ({
  id: 1,
  path,
  title: 'Услуги',
  updatedAt: '2026-10-01T00:00:00.000Z',
  fields,
})
const meta = (p: SitePage): PageMeta => ({
  title: p.title,
  description: '',
  canonical: `${site.url}${p.path}`,
  robots: { index: true, follow: true },
  openGraph: { title: p.title, description: '', type: 'website' },
  jsonLd: [],
})

describe('мета-теги', () => {
  it('заголовок по шаблону, если свой не задан', () => {
    const p = page('/uslugi')
    expect(buildMeta(meta(p), p, site, { titleTemplate: '%s — %site' }).title).toBe('Услуги — Renote')
  })

  it('свой заголовок страницы важнее шаблона', () => {
    const p = page('/uslugi', { title: 'Разработка сайтов в Москве' })
    expect(buildMeta(meta(p), p, site, { titleTemplate: '%s — %site' }).title).toBe(
      'Разработка сайтов в Москве',
    )
  })

  it('описание берётся из страницы или из настроек и обрезается по слову', () => {
    const p = page('/uslugi')
    const long = 'слово '.repeat(60)
    const result = buildMeta(meta(p), p, site, { defaultDescription: long })
    expect(result.description.length).toBeLessThanOrEqual(160)
    expect(result.description.endsWith('…')).toBe(true)
    expect(clampDescription('  коротко   и\nясно ')).toBe('коротко и ясно')
  })

  it('noindex страницы и закрытый сайт отключают индексацию', () => {
    const p = page('/uslugi', { noindex: true })
    expect(buildMeta(meta(p), p, site, {}).robots).toEqual({ index: false, follow: true })
    const open = page('/uslugi')
    expect(buildMeta(meta(open), open, site, { indexSite: false }).robots).toEqual({
      index: false,
      follow: false,
    })
  })

  it('canonical и картинка соцсетей становятся абсолютными', () => {
    const p = page('/uslugi', { canonical: '/uslugi/razrabotka', ogImage: { url: '/api/media/file/a.webp' } })
    const result = buildMeta(meta(p), p, site, {})
    expect(result.canonical).toBe('https://renote.ru/uslugi/razrabotka')
    expect(result.openGraph.image).toBe('https://renote.ru/api/media/file/a.webp')
  })

  it('на главной — разметка WebSite', () => {
    const p = page('/')
    expect(buildMeta(meta(p), p, site, {}).jsonLd).toContainEqual(
      expect.objectContaining({ '@type': 'WebSite' }),
    )
  })

  it('без названия сайта — только заголовок, без висящего разделителя', () => {
    expect(applyTitleTemplate('%s — %site', 'Услуги', { ...site, name: '' })).toBe('Услуги')
  })

  it('шаблон без %site', () => {
    expect(applyTitleTemplate('%s | Компания', 'Контакты', site)).toBe('Контакты | Компания')
  })
})

describe('sitemap', () => {
  const entries = [{ path: '/' }, { path: '/uslugi' }, { path: '/uslugi/razrabotka' }, { path: '/skryto' }]
  const pages = [page('/skryto', { noindex: true }), page('/uslugi')]

  it('страницы с noindex не попадают в sitemap, приоритет падает с глубиной', () => {
    const result = buildSitemap(entries, pages, {})
    expect(result.map((e) => e.path)).toEqual(['/', '/uslugi', '/uslugi/razrabotka'])
    expect(result.map((e) => e.priority)).toEqual([1, 0.8, 0.7])
    expect(result[0]?.changefreq).toBe('weekly')
  })

  it('закрытый сайт отдаёт пустой sitemap', () => {
    expect(buildSitemap(entries, pages, { indexSite: false })).toEqual([])
  })
})

describe('robots.txt', () => {
  const base = ['User-agent: *', 'Disallow: /admin']

  it('добавляет закрытые пути, директивы и адрес sitemap', () => {
    const lines = buildRobots(base, site, {
      robotsDisallow: '/search\n\n /cart ',
      robotsExtra: 'Clean-param: utm',
    })
    expect(lines).toEqual([
      'User-agent: *',
      'Disallow: /admin',
      'Disallow: /search',
      'Disallow: /cart',
      '',
      'Clean-param: utm',
      '',
      'Sitemap: https://renote.ru/sitemap.xml',
    ])
  })

  it('закрытый сайт закрыт целиком', () => {
    expect(buildRobots(base, site, { indexSite: false })).toEqual(['User-agent: *', 'Disallow: /'])
  })
})

describe('хлебные крошки', () => {
  it('главная всегда первая и с названием из настроек', () => {
    const crumbs = [
      { label: 'Услуги', path: '/uslugi' },
      { label: 'Разработка', path: '/uslugi/razrabotka' },
    ]
    expect(buildBreadcrumbs(crumbs, { breadcrumbsHome: 'Renote' })).toEqual([
      { label: 'Renote', path: '/' },
      ...crumbs,
    ])
  })
})
