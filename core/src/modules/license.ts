import { createPublicKey, verify } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import type { ModuleManifest } from '@renote/module-sdk'

// Офлайн-лицензия модуля, подписанная Ed25519 (ADR-008).
export type LicensePayload = {
  module: string
  sku: string
  cell: string
  validUntil: string
  graceDays: number
  // Лицензия передачи (ADR-009): бессрочная, привязана к домену клиента.
  exit: boolean
  domain?: string
}

export type LicenseState =
  | { state: 'free' }
  | { state: 'valid' | 'grace' | 'expired'; license: LicensePayload }
  | { state: 'missing' | 'invalid'; reason: string }

// Файлы лицензий кладёт Платформа (ADR-008); в dev — deploy/dev/init-env.sh.
const LICENSE_DIR = path.resolve(process.env.LICENSE_DIR ?? 'licenses')
const DAY = 24 * 60 * 60 * 1000

const cache = new Map<string, { mtime: number; result: LicenseState }>()

const evaluate = (license: LicensePayload, at = Date.now()): LicenseState => {
  const until = Date.parse(license.validUntil)
  if (at <= until) return { state: 'valid', license }
  if (at <= until + license.graceDays * DAY) return { state: 'grace', license }
  return { state: 'expired', license }
}

export const checkLicense = (manifest: ModuleManifest): LicenseState => {
  if (manifest.license.model === 'free') return { state: 'free' }

  const file = path.join(LICENSE_DIR, `${manifest.id}.json`)
  let mtime: number
  try {
    mtime = statSync(file).mtimeMs
  } catch {
    return { state: 'missing', reason: 'Файл лицензии не найден' }
  }

  // Подпись проверяем только при смене файла, срок — при каждом обращении.
  const cached = cache.get(file)
  if (cached?.mtime === mtime) {
    return 'license' in cached.result ? evaluate(cached.result.license) : cached.result
  }

  let result: LicenseState
  try {
    const { payload, signature } = JSON.parse(readFileSync(file, 'utf8'))
    const key = createPublicKey(process.env.LICENSE_PUBLIC_KEY?.replace(/\\n/g, '\n') ?? '')
    const ok = verify(null, Buffer.from(JSON.stringify(payload)), key, Buffer.from(signature, 'base64'))
    if (!ok) result = { state: 'invalid', reason: 'Подпись лицензии не сходится' }
    else if (payload.module !== manifest.id || payload.sku !== manifest.license.sku)
      result = { state: 'invalid', reason: 'Лицензия выдана на другой модуль' }
    else if (payload.exit && payload.domain !== process.env.CELL_DOMAIN)
      result = { state: 'invalid', reason: `Лицензия передачи выдана для домена ${payload.domain}` }
    else result = evaluate(payload)
  } catch (e) {
    result = { state: 'invalid', reason: `Лицензию не удалось прочитать: ${(e as Error).message}` }
  }
  cache.set(file, { mtime, result })
  return result
}

// Сколько дней осталось до перехода в режим только для чтения.
export const graceDaysLeft = (license: LicensePayload, at = Date.now()) =>
  Math.ceil((Date.parse(license.validUntil) + license.graceDays * DAY - at) / DAY)

// Писать в данные модуля можно с действующей лицензией или в льготный период.
export const isWritable = (state: LicenseState) =>
  state.state === 'free' || state.state === 'valid' || state.state === 'grace'
