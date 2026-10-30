// Адрес страницы ↔ сегменты маршрута [[...slug]] в Next.
export const pathFromSegments = (segments?: string[]) =>
  segments?.length ? `/${segments.map((s) => decodeURIComponent(s)).join('/')}` : '/'

export const segmentsFromPath = (path: string) => (path === '/' ? [] : path.replace(/^\//, '').split('/'))

// Внешний адрес или путь сайта.
export const isExternal = (url: string) => /^https?:\/\//i.test(url)
