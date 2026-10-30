// Данные сайта и модули seo, redirects, legal на настоящем Payload (веха 3).
import legalModule from '@renote/module-legal'
import redirectsModule from '@renote/module-redirects'
import seoModule from '@renote/module-seo'
import { createServer, type Server } from 'node:http'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { catalogEntry } from './fixtures'
import { callEndpoint, resetDatabase, runQueue } from './helpers'

let payload: Payload
// Сайт-заглушка: принимает сообщения ядра об изменениях.
let site: Server
const received: { secret?: string; tags: string[] }[] = []
const call = (method: string, path: string, opts?: Parameters<typeof callEndpoint>[3]) =>
  callEndpoint(payload, method, path, opts)

const publish = (data: Record<string, unknown>) =>
  payload.create({
    collection: 'pages',
    data: { ...data, _status: 'published' } as never,
    overrideAccess: true,
  })

beforeAll(async () => {
  process.env.SITE_URL = 'https://site.test'
  site = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      received.push({ secret: req.headers['x-renote-secret'] as string, tags: JSON.parse(body).tags })
      res.writeHead(200).end('{}')
    })
  })
  await new Promise<void>((resolve) => site.listen(0, resolve))
  const port = (site.address() as { port: number }).port
  process.env.SITE_REVALIDATE_URL = `http://127.0.0.1:${port}/api/revalidate`
  process.env.SITE_REVALIDATE_SECRET = 'test-secret'
  await resetDatabase()
  const { buildCellConfig } = await import('../../src/cell-config')
  const { postgresAdapter } = await import('@payloadcms/db-postgres')
  payload = await getPayload({
    config: buildCellConfig({
      catalog: [
        catalogEntry('seo', seoModule),
        catalogEntry('redirects', redirectsModule),
        catalogEntry('legal', legalModule),
      ],
      db: postgresAdapter({ pool: { connectionString: process.env.TEST_DATABASE_URL }, push: true }),
    }),
  })
  const { installModule } = await import('../../src/modules/lifecycle')
  for (const id of ['seo', 'redirects', 'legal']) await installModule(payload, id)
  await payload.updateGlobal({ slug: 'site-settings', data: { siteName: 'Renote' }, overrideAccess: true })
  await payload.updateGlobal({
    slug: 'seo-settings' as never,
    data: { titleTemplate: '%s — %site' } as never,
    overrideAccess: true,
  })
}, 120_000)

afterAll(async () => {
  await payload?.destroy()
  site?.close()
})

describe('адреса страниц', () => {
  it('адрес складывается из родителей, главная — /', async () => {
    const home = await publish({ title: 'Главная', slug: 'home' })
    const services = await publish({ title: 'Услуги' })
    const dev = await publish({ title: 'Разработка', parent: services.id })
    expect([home.path, services.path, dev.path]).toEqual(['/', '/uslugi', '/uslugi/razrabotka'])
  })
})

describe('данные страницы для сайта', () => {
  it('мета-теги по шаблону SEO и хлебные крошки от главной', async () => {
    const res = await call('get', '/renote/site/page', { query: { path: '/uslugi/razrabotka' } })
    expect(res.status).toBe(200)
    expect(res.body.meta.title).toBe('Разработка — Renote')
    expect(res.body.meta.canonical).toBe('https://site.test/uslugi/razrabotka')
    expect(res.body.breadcrumbs.map((c: { label: string }) => c.label)).toEqual([
      'Главная',
      'Услуги',
      'Разработка',
    ])
  })

  it('неопубликованной страницы для сайта нет', async () => {
    await payload.create({ collection: 'pages', data: { title: 'Черновик' } as never, overrideAccess: true })
    expect((await call('get', '/renote/site/page', { query: { path: '/chernovik' } })).status).toBe(404)
  })

  it('страница с noindex уходит из sitemap и получает noindex', async () => {
    await publish({ title: 'Спасибо', seo: { noindex: true } })
    const sitemap = await call('get', '/renote/site/sitemap')
    expect(sitemap.body.entries.map((e: { path: string }) => e.path)).not.toContain('/spasibo')
    const page = await call('get', '/renote/site/page', { query: { path: '/spasibo' } })
    expect(page.body.meta.robots.index).toBe(false)
    // Поля модуля сайту не отдаются — только итоговые мета-теги.
    expect(page.body.page).not.toHaveProperty('seo')
  })

  it('robots.txt с адресом sitemap', async () => {
    const res = await call('get', '/renote/site/robots')
    expect(res.body).toContain('Disallow: /admin')
    expect(res.body).toContain('Sitemap: https://site.test/sitemap.xml')
  })
})

describe('автоматические редиректы', () => {
  it('смена адреса раздела создаёт 301 для него и для вложенных страниц', async () => {
    const { docs } = await payload.find({
      collection: 'pages',
      where: { path: { equals: '/uslugi' } },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'pages',
      id: docs[0]!.id,
      data: { slug: 'services', _status: 'published' } as never,
      overrideAccess: true,
    })
    const child = await payload.find({
      collection: 'pages',
      where: { title: { equals: 'Разработка' } },
      overrideAccess: true,
    })
    expect(child.docs[0]?.path).toBe('/services/razrabotka')

    await runQueue(payload)
    const rules = await call('get', '/m/redirects/rules')
    expect(rules.body).toEqual(
      expect.arrayContaining([
        { from: '/uslugi', to: '/services', code: 301 },
        { from: '/uslugi/razrabotka', to: '/services/razrabotka', code: 301 },
      ]),
    )
    expect((await call('get', '/m/redirects/resolve', { query: { path: '/Uslugi/' } })).body).toEqual({
      to: '/services',
      code: 301,
    })
  })

  it('редирект, замыкающий цикл, не сохраняется', async () => {
    await expect(
      payload.create({
        collection: 'redirects-rules',
        data: { from: '/services', to: '/uslugi', code: '301' } as never,
        overrideAccess: true,
      }),
    ).rejects.toThrow('цикл')
  })
})

describe('документы и согласия (152-ФЗ)', () => {
  it('согласие фиксирует редакцию документа и не принимается без обязательного', async () => {
    await payload.create({
      collection: 'legal-documents',
      data: {
        title: 'Политика обработки ПДн',
        slug: 'privacy',
        kind: 'privacy',
        required: true,
        _status: 'published',
      } as never,
      overrideAccess: true,
    })
    expect(
      (await call('post', '/m/legal/consents', { body: { subject: 'a@b.ru', documents: [] } })).status,
    ).toBe(422)

    const res = await call('post', '/m/legal/consents', {
      body: { subject: 'a@b.ru', documents: ['privacy'], source: 'forms:1' },
    })
    expect(res.status).toBe(201)
    const consent = await payload.findByID({
      collection: 'legal-consents',
      id: res.body.consentId,
      overrideAccess: true,
    })
    expect(consent.documents?.[0]).toMatchObject({ slug: 'privacy', title: 'Политика обработки ПДн' })
    expect(consent.documents?.[0]?.hash).toHaveLength(16)
  })

  it('журнал согласий нельзя изменить через API', async () => {
    const { docs } = await payload.find({ collection: 'legal-consents', overrideAccess: true })
    await expect(
      payload.update({
        collection: 'legal-consents',
        id: docs[0]!.id,
        data: { subject: 'x' },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('опубликованные документы попадают в sitemap', async () => {
    const sitemap = await call('get', '/renote/site/sitemap')
    expect(sitemap.body.entries.map((e: { path: string }) => e.path)).toContain('/legal/privacy')
  })
})

describe('удаление модуля SEO', () => {
  it('сайт продолжает работать на мета-тегах по умолчанию', async () => {
    const { uninstallModule } = await import('../../src/modules/lifecycle')
    await uninstallModule(payload, 'seo')
    const page = await call('get', '/renote/site/page', { query: { path: '/services/razrabotka' } })
    expect(page.body.meta.title).toBe('Разработка')
    const robots = await call('get', '/renote/site/robots')
    expect(robots.body).not.toContain('Sitemap:')
  })
})

describe('мгновенное обновление сайта', () => {
  it('публикация страницы сообщает сайту теги с секретом, черновик — нет', async () => {
    await runQueue(payload)
    received.length = 0
    const page = await publish({ title: 'Новости' })
    await runQueue(payload)
    expect(received).toContainEqual({
      secret: 'test-secret',
      tags: expect.arrayContaining(['page:/novosti', 'pages']),
    })

    received.length = 0
    await payload.update({
      collection: 'pages',
      id: page.id,
      data: { title: 'Новости (черновик)' } as never,
      draft: true,
      overrideAccess: true,
    })
    await runQueue(payload)
    expect(received).toEqual([])
  })

  it('установка модуля обновляет весь сайт', async () => {
    const { installModule } = await import('../../src/modules/lifecycle')
    received.length = 0
    await installModule(payload, 'seo')
    await runQueue(payload)
    expect(received.flatMap((r) => r.tags)).toContain('cms')
  })
})
