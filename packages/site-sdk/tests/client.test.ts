import { afterEach, describe, expect, it, vi } from 'vitest'

import { CmsUnavailableError, createCms } from '../src/client'
import { pathFromSegments, segmentsFromPath } from '../src/paths'
import { pathsToWarm, revalidateHandler } from '../src/revalidate'

const cms = createCms({ url: 'http://core:3000/', publicUrl: 'https://cms.site.ru', timeoutMs: 50 })

const respond = (status: number, body: unknown, type = 'application/json') =>
  vi
    .fn()
    .mockResolvedValue(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'content-type': type },
      }),
    )

afterEach(() => vi.unstubAllGlobals())

describe('клиент ядра', () => {
  it('запрашивает страницу по адресу с тегами кеша', async () => {
    const fetchMock = respond(200, { page: {}, meta: {}, breadcrumbs: [] })
    vi.stubGlobal('fetch', fetchMock)
    await cms.page('/uslugi')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('http://core:3000/api/renote/site/page?path=%2Fuslugi')
    expect(init.next.tags).toEqual(['cms', 'page:/uslugi', 'pages', 'modules', 'settings'])
    expect(init.cache).toBe('force-cache')
  })

  it('нет страницы — null, а не ошибка', async () => {
    vi.stubGlobal('fetch', respond(404, { error: 'нет' }))
    expect(await cms.page('/net')).toBeNull()
  })

  it('модуль не установлен — пустой список, сайт работает без него', async () => {
    vi.stubGlobal('fetch', respond(503, { error: 'Модуль временно недоступен' }))
    expect(await cms.redirects()).toEqual([])
    expect(await cms.legalDocuments()).toEqual([])
  })

  it('ядро упало или молчит — понятная ошибка, которую сайт перехватывает', async () => {
    vi.stubGlobal('fetch', respond(500, {}))
    await expect(cms.settings()).rejects.toBeInstanceOf(CmsUnavailableError)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))
    await expect(cms.page('/')).rejects.toThrow('не ответило за 50 мс')
  })

  it('robots.txt приходит текстом', async () => {
    vi.stubGlobal('fetch', respond(200, 'User-agent: *\n', 'text/plain'))
    expect(await cms.robots()).toBe('User-agent: *\n')
  })

  it('медиа и формы идут на публичный адрес ядра', async () => {
    expect(cms.mediaUrl('/api/media/file/a.webp')).toBe('https://cms.site.ru/api/media/file/a.webp')
    const fetchMock = respond(201, { ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const res = await cms.submitForm(1, { phone: '+7900' })
    expect(fetchMock.mock.calls[0]![0]).toBe('https://cms.site.ru/api/m/forms/1/submit')
    expect(res).toMatchObject({ ok: true, status: 201 })
  })
})

describe('обновление кеша по сообщению ядра', () => {
  const call = (secret: string | undefined, body: unknown) => {
    const revalidateTag = vi.fn()
    const handler = revalidateHandler({ secret: 's3cret', revalidateTag })
    const req = new Request('http://site/api/revalidate', {
      method: 'POST',
      headers: secret ? { 'x-renote-secret': secret } : {},
      body: JSON.stringify(body),
    })
    return { revalidateTag, res: handler(req) }
  }

  it('помечает теги устаревшими, но не выбрасывает: при падении ядра сайт отдаёт старое', async () => {
    const { revalidateTag, res } = call('s3cret', { tags: ['page:/', 'pages', 7] })
    expect((await res).status).toBe(200)
    expect(revalidateTag.mock.calls).toEqual([
      ['page:/', 'max'],
      ['pages', 'max'],
    ])
  })

  it('прогревает изменённые страницы и главную при общих изменениях', () => {
    expect(pathsToWarm(['page:/uslugi', 'page:/uslugi/razrabotka'])).toEqual([
      '/uslugi',
      '/uslugi/razrabotka',
    ])
    expect(pathsToWarm(['page:/kontakty', 'pages'])).toEqual(['/kontakty', '/'])
    expect(pathsToWarm(['module:redirects'])).toEqual([])
  })

  it('без секрета ничего не сбрасывает', async () => {
    const { revalidateTag, res } = call('wrong', { tags: ['cms'] })
    expect((await res).status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})

describe('адреса', () => {
  it('сегменты маршрута ↔ адрес страницы', () => {
    expect(pathFromSegments(undefined)).toBe('/')
    expect(pathFromSegments(['uslugi', 'razrabotka'])).toBe('/uslugi/razrabotka')
    expect(pathFromSegments(['%D1%83%D1%81%D0%BB%D1%83%D0%B3%D0%B8'])).toBe('/услуги')
    expect(segmentsFromPath('/')).toEqual([])
    expect(segmentsFromPath('/uslugi/razrabotka')).toEqual(['uslugi', 'razrabotka'])
  })
})
