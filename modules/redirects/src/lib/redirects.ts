// Чистые функции модуля редиректов: нормализация, поиск циклов, разрешение цепочек.

export type RedirectCode = 301 | 302 | 307 | 308
export type Rule = { from: string; to: string; code: RedirectCode; active?: boolean | null }

export const REDIRECT_CODES: RedirectCode[] = [301, 302, 307, 308]
// Больше переходов подряд поисковики не проходят — считаем это ошибкой.
export const MAX_HOPS = 5

export const isExternal = (target: string) => /^https?:\/\//i.test(target)

// Путь сайта в одном виде: начинается с /, без домена, без слеша в конце, в нижнем регистре.
// Запрос (?utm=…) и якорь отбрасываются: правило задаётся для страницы, а не для ссылки.
export const normalizePath = (input: string) => {
  let path = input.trim()
  if (isExternal(path)) path = new URL(path).pathname
  path = path.split(/[?#]/)[0] ?? ''
  if (!path.startsWith('/')) path = `/${path}`
  path = path.replace(/\/{2,}/g, '/').toLowerCase()
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return decodeURI(path)
}

// Цель — либо путь сайта, либо внешний адрес как есть.
export const normalizeTarget = (input: string) =>
  isExternal(input.trim()) ? input.trim() : normalizePath(input)

const activeRules = (rules: Rule[]) =>
  new Map(rules.filter((r) => r.active !== false).map((r) => [r.from, r]))

// Куда в итоге ведёт путь: проходит цепочку правил. null — правила нет.
export const resolve = (path: string, rules: Rule[]) => {
  const byFrom = activeRules(rules)
  const seen = new Set<string>()
  let current = normalizePath(path)
  let first: Rule | undefined
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const rule = byFrom.get(current)
    if (!rule) break
    first ??= rule
    if (seen.has(current)) return { error: 'cycle' as const }
    seen.add(current)
    current = rule.to
    if (isExternal(current)) break
  }
  if (!first) return null
  // Код первого правила: он определяет, постоянный переход или временный.
  return { to: current, code: first.code }
}

// Создаст ли правило from → to цикл вместе с уже существующими правилами.
export const createsCycle = (rule: Pick<Rule, 'from' | 'to'>, rules: Rule[]) => {
  if (rule.from === rule.to) return true
  const byFrom = activeRules(rules.filter((r) => r.from !== rule.from))
  let current = rule.to
  for (let hop = 0; hop < 100 && !isExternal(current); hop++) {
    if (current === rule.from) return true
    const next = byFrom.get(current)
    if (!next) return false
    current = next.to
  }
  return false
}

export type PathChangePlan = {
  create?: Rule
  retarget: { from: string; to: string }[]
  remove: string[]
}

// Страница переехала с from на to: что сделать с правилами.
// - создать 301 со старого адреса;
// - правила, которые вели на старый адрес, перенаправить сразу на новый (без цепочек);
// - удалить правило со нового адреса, если оно было (страница вернулась на прежний адрес).
export const planPathChange = (from: string, to: string, rules: Rule[]): PathChangePlan => {
  const source = normalizePath(from)
  const target = normalizePath(to)
  return {
    create: rules.some((r) => r.from === source) ? undefined : { from: source, to: target, code: 301 },
    retarget: rules
      .filter((r) => r.to === source && r.from !== target)
      .map((r) => ({ from: r.from, to: target })),
    remove: rules.filter((r) => r.from === target).map((r) => r.from),
  }
}

// Импорт списком: «откуда куда [код]» по строке, разделитель — пробел, табуляция или запятая.
export const parseImport = (text: string) => {
  const rules: Rule[] = []
  const errors: string[] = []
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    const [from, to, codeText] = line.split(/[\s,;]+/)
    const code = Number(codeText ?? 301) as RedirectCode
    if (!from || !to) errors.push(`строка ${i + 1}: нужно «откуда куда»`)
    else if (!REDIRECT_CODES.includes(code)) errors.push(`строка ${i + 1}: код ${codeText} не поддерживается`)
    else rules.push({ from: normalizePath(from), to: normalizeTarget(to), code })
  })
  return { rules, errors }
}
