import { describe, expect, it } from 'vitest'

import {
  createsCycle,
  normalizePath,
  parseImport,
  planPathChange,
  resolve,
  type Rule,
} from '../src/lib/redirects'

describe('нормализация путей', () => {
  it('приводит адреса к одному виду', () => {
    expect(normalizePath('Uslugi/')).toBe('/uslugi')
    expect(normalizePath('https://old.ru/Catalog/Item/?utm=1#top')).toBe('/catalog/item')
    expect(normalizePath('//a//b//')).toBe('/a/b')
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath('/%D1%83%D1%81%D0%BB%D1%83%D0%B3%D0%B8')).toBe('/услуги')
  })
})

const rules: Rule[] = [
  { from: '/a', to: '/b', code: 301 },
  { from: '/b', to: '/c', code: 302 },
  { from: '/old', to: 'https://other.ru/new', code: 301 },
  { from: '/off', to: '/c', code: 301, active: false },
]

describe('разрешение цепочек', () => {
  it('проходит цепочку до конца и берёт код первого правила', () => {
    expect(resolve('/A/', rules)).toEqual({ to: '/c', code: 301 })
  })

  it('внешняя цель возвращается как есть', () => {
    expect(resolve('/old', rules)).toEqual({ to: 'https://other.ru/new', code: 301 })
  })

  it('выключенные правила и пути без правил не перенаправляют', () => {
    expect(resolve('/off', rules)).toBeNull()
    expect(resolve('/nothing', rules)).toBeNull()
  })

  it('цикл распознаётся, а не зацикливает сайт', () => {
    const loop: Rule[] = [
      { from: '/x', to: '/y', code: 301 },
      { from: '/y', to: '/x', code: 301 },
    ]
    expect(resolve('/x', loop)).toEqual({ error: 'cycle' })
  })
})

describe('проверка циклов при сохранении', () => {
  it('ловит цикл через всю цепочку, а не только «сам на себя»', () => {
    expect(createsCycle({ from: '/c', to: '/a' }, rules)).toBe(true)
    expect(createsCycle({ from: '/x', to: '/x' }, rules)).toBe(true)
    expect(createsCycle({ from: '/d', to: '/a' }, rules)).toBe(false)
  })

  it('изменение самого правила не считается циклом с его старой версией', () => {
    expect(createsCycle({ from: '/a', to: '/c' }, rules)).toBe(false)
  })
})

describe('смена адреса страницы', () => {
  it('создаёт 301 и переводит старые правила сразу на новый адрес', () => {
    const plan = planPathChange('/uslugi', '/services', [{ from: '/staroe', to: '/uslugi', code: 301 }])
    expect(plan.create).toEqual({ from: '/uslugi', to: '/services', code: 301 })
    expect(plan.retarget).toEqual([{ from: '/staroe', to: '/services' }])
  })

  it('страница вернулась на прежний адрес — правило с него убирается', () => {
    const plan = planPathChange('/services', '/uslugi', [{ from: '/uslugi', to: '/services', code: 301 }])
    expect(plan.remove).toEqual(['/uslugi'])
    expect(plan.create).toEqual({ from: '/services', to: '/uslugi', code: 301 })
  })
})

describe('импорт списком', () => {
  it('разбирает строки и сообщает об ошибках с номером строки', () => {
    const { rules: parsed, errors } = parseImport('# комментарий\n/old /new\n/a,/b,302\n/bad\n/x /y 404')
    expect(parsed).toEqual([
      { from: '/old', to: '/new', code: 301 },
      { from: '/a', to: '/b', code: 302 },
    ])
    expect(errors).toEqual(['строка 4: нужно «откуда куда»', 'строка 5: код 404 не поддерживается'])
  })
})
