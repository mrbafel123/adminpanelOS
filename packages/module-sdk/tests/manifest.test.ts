import { describe, expect, it } from 'vitest'

import { validateManifest, type ModuleManifest } from '../src/manifest'

const valid: ModuleManifest = {
  id: 'forms',
  name: 'Формы',
  version: '1.0.0',
  core: '>=0.1 <1.0',
  runtime: 'inprocess',
  license: { model: 'subscription', sku: 'forms-pro' },
  events: { emits: ['forms.submitted.v1'] },
  degradation: 'Заявки принимаются всегда',
}
const check = (m: Partial<ModuleManifest>) => validateManifest(m, { dir: 'forms', coreVersion: '0.1.0' })

describe('манифест модуля', () => {
  it('корректный манифест проходит', () => {
    expect(check(valid)).toEqual([])
  })

  it('id должен совпадать с папкой', () => {
    expect(check({ ...valid, id: 'form' })).toContainEqual(expect.stringContaining('не совпадает с папкой'))
  })

  it('несовместимая версия ядра', () => {
    expect(check({ ...valid, core: '>=2.0' })).toContainEqual(expect.stringContaining('требует ядро'))
  })

  it('платному модулю нужен sku', () => {
    expect(check({ ...valid, license: { model: 'subscription' } })).toContainEqual(
      expect.stringContaining('sku'),
    )
  })

  it('события только с версией', () => {
    expect(check({ ...valid, events: { emits: ['forms.submitted'] } })).toContainEqual(
      expect.stringContaining('.vN'),
    )
  })

  it('без описания деградации нельзя', () => {
    expect(check({ ...valid, degradation: '' })).toContainEqual(expect.stringContaining('degradation'))
  })
})
