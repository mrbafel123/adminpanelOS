import { describe, expect, it } from 'vitest'

import { slugify } from '../src/fields/slug'

describe('slugify', () => {
  it('транслитерирует русский заголовок', () => {
    expect(slugify('Разработка сайтов')).toBe('razrabotka-saytov')
  })

  it('убирает знаки и лишние дефисы', () => {
    expect(slugify('  «Щука» — и ёжик!  ')).toBe('schuka-i-ezhik')
  })

  it('оставляет латиницу и цифры', () => {
    expect(slugify('SEO 2026')).toBe('seo-2026')
  })
})
