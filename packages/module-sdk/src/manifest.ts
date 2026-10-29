import semver from 'semver'

// Манифест модуля, module.yaml (ADR-003). Поле migrations убрано ADR-013:
// схема модулей — часть цепочки миграций ядра.
export type ModuleManifest = {
  id: string
  name: string
  version: string
  core: string
  requires?: string[]
  runtime: 'inprocess' | 'container'
  permissions?: string[]
  settings?: string
  admin?: { menu?: { title: string; icon?: string } }
  site?: { blocks?: string[] }
  events?: { emits?: string[]; consumes?: string[] }
  license: { model: 'free' | 'subscription' | 'perpetual'; sku?: string }
  degradation: string
}

const LICENSE_MODELS = ['free', 'subscription', 'perpetual']
const EVENT = /^[a-z0-9-]+(\.[a-z0-9-]+)+\.v\d+$/

// Список ошибок, из-за которых модуль нельзя включать в каталог.
export const validateManifest = (
  m: Partial<ModuleManifest>,
  { dir, coreVersion }: { dir: string; coreVersion: string },
) => {
  const errors: string[] = []
  if (!m.id || !/^[a-z][a-z0-9-]*$/.test(m.id)) errors.push('id должен быть в kebab-case')
  else if (m.id !== dir) errors.push(`id "${m.id}" не совпадает с папкой "${dir}"`)
  if (!m.name) errors.push('нужно человеческое название name')
  if (!m.version || !semver.valid(m.version)) errors.push(`version "${m.version}" не по semver`)
  if (!m.core || !semver.validRange(m.core)) errors.push(`core "${m.core}" — неверный диапазон`)
  else if (!semver.satisfies(coreVersion, m.core))
    errors.push(`модуль требует ядро ${m.core}, а ядро ${coreVersion}`)
  if (m.runtime !== 'inprocess') errors.push(`runtime "${m.runtime}" пока не поддержан`)
  if (!m.license || !LICENSE_MODELS.includes(m.license.model))
    errors.push('license.model: free | subscription | perpetual')
  else if (m.license.model !== 'free' && !m.license.sku) errors.push('для платного модуля нужен license.sku')
  if (!m.degradation) errors.push('опишите degradation: что происходит при сбое модуля')
  for (const event of [...(m.events?.emits ?? []), ...(m.events?.consumes ?? [])]) {
    if (!EVENT.test(event)) errors.push(`событие ${event} без версии .vN`)
  }
  if (m.requires?.includes(m.id ?? '')) errors.push('модуль не может зависеть от себя')
  return errors
}
