// Приём сообщения ядра «данные изменились» (ADR-005). Next передаётся снаружи,
// чтобы SDK не зависел от его версии:
//   export const POST = revalidateHandler({ secret, revalidateTag, onRevalidated })
//
// Профиль 'max': устаревшая версия отдаётся, пока свежая собирается в фоне. Так сайт
// переживает падение ядра — старые страницы остаются (ADR-002, изоляция отказов важнее).
// Чтобы первый посетитель не увидел старую версию, onRevalidated прогревает изменённые
// страницы: первый запрос после сброса запускает пересборку.
type RevalidateTag = (tag: string, profile: 'max') => void

export const revalidateHandler =
  ({
    secret,
    revalidateTag,
    onRevalidated,
  }: {
    secret?: string
    revalidateTag: RevalidateTag
    onRevalidated?: (tags: string[]) => void
  }) =>
  async (req: Request) => {
    if (!secret || req.headers.get('x-renote-secret') !== secret) {
      return Response.json({ error: 'Неверный секрет' }, { status: 401 })
    }
    const body = (await req.json().catch(() => ({}))) as { tags?: unknown }
    const list = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === 'string') : []
    for (const tag of list) revalidateTag(tag, 'max')
    onRevalidated?.(list)
    return Response.json({ revalidated: list })
  }

// Какие адреса прогреть после сброса тегов: изменённые страницы и главная,
// если изменилось что-то общее (меню, настройки, модули).
export const pathsToWarm = (tags: string[]) => {
  const paths = new Set(tags.filter((t) => t.startsWith('page:')).map((t) => t.slice('page:'.length)))
  if (tags.some((t) => ['cms', 'pages', 'modules', 'settings'].includes(t))) paths.add('/')
  return [...paths]
}
