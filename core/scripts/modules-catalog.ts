// Каталог модулей в сборке ядра (ADR-013).
//   tsx scripts/modules-catalog.ts
// Читает modules/*/module.yaml и settings-схемы, проверяет манифесты и пишет
// src/modules/catalog.generated.ts. Во время работы ядро ничего не читает с диска.
// MODULES_INCLUDE=forms,seo — только перечисленные модули (сборка передачи, ADR-009).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateManifest, type ModuleManifest } from '@renote/module-sdk/manifest'
import { parse } from 'yaml'

const coreDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const modulesDir = path.resolve(coreDir, '../modules')
const outFile = path.join(coreDir, 'src/modules/catalog.generated.ts')
const coreVersion: string = JSON.parse(readFileSync(path.join(coreDir, 'package.json'), 'utf8')).version

const include = process.env.MODULES_INCLUDE?.split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const dirs = readdirSync(modulesDir)
  .filter((dir) => existsSync(path.join(modulesDir, dir, 'module.yaml')))
  .filter((dir) => !include || include.includes(dir))
  .sort()

const failures: string[] = []
const entries = dirs.map((dir) => {
  const root = path.join(modulesDir, dir)
  const manifest = parse(readFileSync(path.join(root, 'module.yaml'), 'utf8')) as ModuleManifest
  const errors = validateManifest(manifest, { dir, coreVersion })
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
  if (!pkg.name) errors.push('в package.json модуля нет name')
  if (manifest.settings && !existsSync(path.join(root, manifest.settings)))
    errors.push(`нет файла ${manifest.settings}`)
  if (errors.length) failures.push(`${dir}: ${errors.join('; ')}`)
  const settingsSchema = manifest.settings
    ? JSON.parse(readFileSync(path.join(root, manifest.settings), 'utf8'))
    : null
  return { dir, pkg: pkg.name as string, manifest, settingsSchema }
})

for (const entry of entries) {
  for (const dep of entry.manifest.requires ?? []) {
    if (!entries.some((e) => e.manifest.id === dep))
      failures.push(`${entry.dir}: нет зависимости ${dep} в каталоге`)
  }
}

if (failures.length) {
  console.error(`Каталог модулей не собран:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}

const ident = (dir: string) => `module_${dir.replace(/-/g, '_')}`
const source = [
  '// Сгенерировано scripts/modules-catalog.ts — не редактировать (ADR-013).',
  "import type { CatalogEntry } from './types'",
  ...entries.map((e) => `import ${ident(e.dir)} from '${e.pkg}'`),
  '',
  `export const CORE_VERSION = ${JSON.stringify(coreVersion)}`,
  '',
  'export const catalog: CatalogEntry[] = [',
  ...entries.map(
    (e) =>
      `  { manifest: ${JSON.stringify(e.manifest)}, settingsSchema: ${JSON.stringify(e.settingsSchema)}, definition: ${ident(e.dir)} },`,
  ),
  ']',
  '',
].join('\n')

writeFileSync(outFile, source)
console.log(
  `Каталог модулей: ${entries.map((e) => `${e.manifest.id}@${e.manifest.version}`).join(', ') || 'пусто'}`,
)
