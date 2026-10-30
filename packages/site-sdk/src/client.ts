import type { Breadcrumb, PageMeta, SitemapEntry, SiteInfo } from '@renote/module-sdk/extension-points'

import type { LegalDocument, Page, SiteSetting } from './content-types.generated'
import { tags } from './tags'

export type CmsConfig = {
  // Адрес ядра для сервера сайта: http://core:3000 в Docker.
  url: string
  // Адрес ядра для браузера посетителя: формы и картинки. По умолчанию — url.
  publicUrl?: string
  // Сколько ждать ядро. Дольше — сайт отдаёт закешированное или страницу ошибки.
  timeoutMs?: number
  // Подстраховка на случай, если ядро не сообщило об изменении: перечитать раз в N секунд.
  revalidateSeconds?: number
}

export type PageData = { page: Page; meta: PageMeta; breadcrumbs: Breadcrumb[] }
export type MenuItem = { title: string; path: string }
export type RedirectRule = { from: string; to: string; code: 301 | 302 | 307 | 308 }
export type LegalDocumentSummary = {
  slug: string
  title: string
  required: boolean
  updatedAt: string
  path: string
}

// Ядро недоступно или ответило ошибкой. Сайт показывает закешированное или страницу ошибки.
export class CmsUnavailableError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message)
    this.name = 'CmsUnavailableError'
  }
}

type FetchInit = RequestInit & { next?: { tags?: string[]; revalidate?: number | false } }

export const createCms = ({
  url,
  publicUrl = url,
  timeoutMs = 3000,
  revalidateSeconds = 3600,
}: CmsConfig) => {
  const base = url.replace(/\/$/, '')

  // Все запросы к ядру кешируются с тегами: ядро после публикации сбрасывает нужные теги.
  const request = async <T>(
    path: string,
    cacheTags: string[],
    { notFound = false } = {},
  ): Promise<T | null> => {
    let res: Response
    try {
      res = await fetch(`${base}/api${path}`, {
        cache: 'force-cache',
        next: { tags: [tags.all, ...cacheTags], revalidate: revalidateSeconds },
        signal: AbortSignal.timeout(timeoutMs),
      } as FetchInit)
    } catch (e) {
      throw new CmsUnavailableError(`Ядро не ответило за ${timeoutMs} мс: ${(e as Error).message}`)
    }
    // 404 — данных нет; 503 у маршрута модуля — модуль не установлен или выключен.
    if (notFound && (res.status === 404 || res.status === 503)) return null
    if (!res.ok) throw new CmsUnavailableError(`Ядро ответило ${res.status} на ${path}`, res.status)
    const type = res.headers.get('content-type') ?? ''
    return (type.includes('json') ? await res.json() : await res.text()) as T
  }

  const query = (params: Record<string, string | number>) =>
    new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()

  // Отправка из браузера посетителя — без кеша.
  const post = async <T>(path: string, body: unknown) => {
    const res = await fetch(`${publicUrl.replace(/\/$/, '')}/api${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as T & {
      errors?: Record<string, string> | string[]
      error?: string
    }
    return { ok: res.ok, status: res.status, data }
  }

  return {
    // Страница по адресу со всем, что нужно для отрисовки: мета-теги и хлебные крошки.
    page: (path: string) =>
      request<PageData>(
        `/renote/site/page?${query({ path })}`,
        [tags.page(path), tags.pages, tags.modules, tags.settings],
        {
          notFound: true,
        },
      ),

    // Адреса всех опубликованных страниц — для сборки страниц заранее.
    paths: async () => {
      const data = await request<{ docs: { path?: string | null }[] }>(
        `/pages?${query({ limit: 5000, depth: 0, 'select[path]': 'true', pagination: 'false' })}`,
        [tags.pages],
      )
      return (data?.docs ?? []).map((d) => d.path).filter((p): p is string => !!p)
    },

    // Меню: опубликованные страницы первого уровня, кроме главной.
    menu: async (): Promise<MenuItem[]> => {
      const data = await request<{ docs: { title: string; path?: string | null }[] }>(
        `/pages?${query({ limit: 50, depth: 0, sort: 'createdAt', 'where[parent][exists]': 'false', 'select[title]': 'true', 'select[path]': 'true' })}`,
        [tags.pages],
      )
      return (data?.docs ?? [])
        .filter((d) => d.path && d.path !== '/')
        .map((d) => ({ title: d.title, path: d.path! }))
    },

    settings: () => request<SiteSetting>('/globals/site-settings?depth=1', [tags.settings]),

    sitemap: () =>
      request<{ site: SiteInfo; entries: SitemapEntry[] }>('/renote/site/sitemap', [
        tags.pages,
        tags.modules,
      ]),

    robots: () => request<string>('/renote/site/robots', [tags.modules, tags.settings]),

    // Редиректы модуля redirects. Модуль не установлен — правил нет.
    redirects: async () =>
      (await request<RedirectRule[]>('/m/redirects/rules', [tags.module('redirects')], { notFound: true })) ??
      [],

    redirect: (path: string) =>
      request<{ to: string; code: RedirectRule['code'] }>(
        `/m/redirects/resolve?${query({ path })}`,
        [tags.module('redirects')],
        { notFound: true },
      ),

    // Документы модуля legal: политика конфиденциальности и другие.
    legalDocuments: async () =>
      (await request<LegalDocumentSummary[]>('/m/legal/documents', [tags.module('legal')], {
        notFound: true,
      })) ?? [],

    legalDocument: (slug: string) =>
      request<LegalDocument>(`/m/legal/documents/${encodeURIComponent(slug)}`, [tags.module('legal')], {
        notFound: true,
      }),

    // Абсолютный адрес файла медиа для браузера.
    mediaUrl: (path?: string | null) => (path ? `${publicUrl.replace(/\/$/, '')}${path}` : undefined),

    // Вызываются из браузера посетителя.
    submitForm: (formId: number | string, data: Record<string, unknown>) =>
      post<{ ok?: boolean; message?: string }>(`/m/forms/${formId}/submit`, data),

    giveConsent: (body: { subject: string; documents: string[]; source?: string }) =>
      post<{ consentId?: number | string }>('/m/legal/consents', body),
  }
}

export type Cms = ReturnType<typeof createCms>
