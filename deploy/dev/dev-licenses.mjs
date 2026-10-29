// Лицензии модулей для локальной ячейки (ADR-008).
// В рабочих ячейках их выпускает Платформа; здесь — локальный ключ разработчика.
// Создаёт ключ один раз, дописывает публичный ключ в .env и выпускает лицензии
// на год для всех платных модулей каталога. Повторный запуск перевыпускает лицензии.
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const keyFile = path.join(here, '.keys', 'license-dev.pem')
const licenseDir = path.join(here, 'licenses')
const modulesDir = path.resolve(here, '../../modules')
const envFile = path.join(here, '.env')
const YEAR = 365 * 24 * 60 * 60 * 1000

if (!existsSync(keyFile)) {
  mkdirSync(path.dirname(keyFile), { recursive: true })
  const { privateKey } = generateKeyPairSync('ed25519')
  writeFileSync(keyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
}
const privateKey = createPrivateKey(readFileSync(keyFile))

const env = readFileSync(envFile, 'utf8')
if (!/^LICENSE_PUBLIC_KEY=/m.test(env)) {
  const pub = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString().trim().replace(/\n/g, '\\n')
  appendFileSync(envFile, `${env.endsWith('\n') ? '' : '\n'}LICENSE_PUBLIC_KEY="${pub}"\n`)
}

// Достаточно простого разбора: нужны только id и license.sku.
const field = (yaml, re) => yaml.match(re)?.[1]
mkdirSync(licenseDir, { recursive: true })
const issued = []
for (const dir of readdirSync(modulesDir)) {
  const file = path.join(modulesDir, dir, 'module.yaml')
  if (!existsSync(file)) continue
  const yaml = readFileSync(file, 'utf8')
  const sku = field(yaml, /sku:\s*([\w-]+)/)
  if (!sku) continue
  const payload = {
    module: field(yaml, /^id:\s*([\w-]+)/m),
    sku,
    cell: 'dev',
    validUntil: new Date(Date.now() + YEAR).toISOString(),
    graceDays: 14,
    exit: false,
  }
  const signature = sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64')
  writeFileSync(path.join(licenseDir, `${payload.module}.json`), JSON.stringify({ payload, signature }, null, 2) + '\n')
  issued.push(payload.module)
}
console.log(`Лицензии для разработки: ${issued.join(', ') || 'платных модулей нет'}`)
