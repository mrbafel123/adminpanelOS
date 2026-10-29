import { defineModule, type ModuleManifest } from '@renote/module-sdk'
import formsModule from '@renote/module-forms'
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'

import type { CatalogEntry } from '../../src/modules/types'

const base = (id: string, extra: Partial<ModuleManifest> = {}): ModuleManifest => ({
  id,
  name: id,
  version: '1.0.0',
  core: '*',
  runtime: 'inprocess',
  license: { model: 'free' },
  degradation: 'тест',
  ...extra,
})

const formsRoot = path.resolve(import.meta.dirname, '../../../modules/forms')

// Тестовый каталог: настоящий модуль forms и модули, которые ломаются нарочно.
export const testCatalog: CatalogEntry[] = [
  {
    manifest: parse(readFileSync(path.join(formsRoot, 'module.yaml'), 'utf8')),
    settingsSchema: JSON.parse(readFileSync(path.join(formsRoot, 'settings.schema.json'), 'utf8')),
    definition: formsModule,
  },
  {
    manifest: base('broken'),
    settingsSchema: null,
    definition: defineModule({
      setup: () => {
        throw new Error('модуль сломан при запуске')
      },
    }),
  },
  {
    manifest: base('slow'),
    settingsSchema: null,
    definition: defineModule({
      setup: () => ({
        collections: [{ name: 'notes', fields: [{ name: 'text', type: 'text' }] }],
        filters: {
          'page.meta': async (meta: { title: string }) => {
            await new Promise((resolve) => setTimeout(resolve, 200))
            return { ...meta, title: `${meta.title} — slow` }
          },
        },
      }),
    }),
  },
  {
    manifest: base('addon', { requires: ['forms'] }),
    settingsSchema: null,
    definition: defineModule({ setup: () => ({}) }),
  },
  {
    manifest: base('killed'),
    settingsSchema: null,
    definition: defineModule({ setup: () => ({}) }),
  },
]

// Лицензии подписываются тестовым ключом, как это делает Платформа.
export const createLicenses = (dir: string) => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  mkdirSync(dir, { recursive: true })
  const issue = (module: string, sku: string, days: number, key: KeyObject = privateKey) => {
    const payload = {
      module,
      sku,
      cell: 'test',
      validUntil: new Date(Date.now() + days * 86_400_000).toISOString(),
      graceDays: 0,
      exit: false,
    }
    const signature = sign(null, Buffer.from(JSON.stringify(payload)), key).toString('base64')
    writeFileSync(path.join(dir, `${module}.json`), JSON.stringify({ payload, signature }))
  }
  return { publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(), issue }
}
