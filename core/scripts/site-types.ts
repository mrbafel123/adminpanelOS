// Типы контента для сайта (@renote/site-sdk/content). Запускается после generate:types.
// Блок `declare module 'payload'` отрезается: сайт не зависит от Payload.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const coreDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(path.join(coreDir, 'src/payload-types.ts'), 'utf8')
const cut = source.indexOf("declare module 'payload'")
const target = path.resolve(coreDir, '../packages/site-sdk/src/content-types.generated.ts')
writeFileSync(
  target,
  `// Сгенерировано core/scripts/site-types.ts из типов ядра — не редактировать.\n${cut === -1 ? source : source.slice(0, cut)}`,
)
console.log(`Типы контента для сайта: ${path.relative(process.cwd(), target)}`)
