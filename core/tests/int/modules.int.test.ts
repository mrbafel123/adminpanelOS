// Модульная система на настоящем Payload и Postgres (веха 2, ADR-003, ADR-013).
// Нужна тестовая база: TEST_DATABASE_URL (см. README, раздел «Тесты»).
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createPayloadRequest, getPayload, type Payload, type User } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createLicenses, testCatalog } from './fixtures'

const licenseDir = mkdtempSync(path.join(os.tmpdir(), 'renote-licenses-'))
const licenses = createLicenses(licenseDir)

let payload: Payload
let owner: User

// Вызов маршрута модуля без HTTP: тот же обработчик, что и у настоящего запроса.
const callEndpoint = async (method: string, urlPath: string, body?: unknown) => {
  const endpoint = payload.config.endpoints.find((e) => {
    if (e.method !== method) return false
    const pattern = new RegExp(`^${e.path.replace(/:\w+\*/g, '.*').replace(/:\w+/g, '[^/]+')}$`)
    return pattern.test(urlPath)
  })
  if (!endpoint) throw new Error(`Нет маршрута ${method} ${urlPath}`)
  const names = [...endpoint.path.matchAll(/:(\w+)/g)].map((m) => m[1])
  const values = urlPath.split('/').filter((_, i) => endpoint.path.split('/')[i]?.startsWith(':'))
  const req = await createPayloadRequest({ payload })
  req.routeParams = Object.fromEntries(names.map((n, i) => [n, values[i]]))
  req.data = body as Record<string, unknown>
  req.headers = new Headers()
  const res = await endpoint.handler(req)
  return { status: res.status, body: await res.json() }
}

const ownerApi = { overrideAccess: false } as const

beforeAll(async () => {
  process.env.LICENSE_DIR = licenseDir
  process.env.LICENSE_PUBLIC_KEY = licenses.publicKey
  process.env.RENOTE_KILLED_MODULES = 'killed'
  licenses.issue('forms', 'forms-pro', 30)

  const { buildCellConfig } = await import('../../src/cell-config')
  const { postgresAdapter } = await import('@payloadcms/db-postgres')
  payload = await getPayload({
    config: buildCellConfig({
      catalog: testCatalog,
      db: postgresAdapter({ pool: { connectionString: process.env.TEST_DATABASE_URL }, push: true }),
    }),
  })
  // Каждый прогон — с чистыми данными: база тестов переживает прогоны.
  for (const collection of ['forms-submissions', 'forms', 'cell-modules', 'payload-jobs'] as const) {
    await payload.db.deleteMany({ collection, where: {} })
  }
  await payload.delete({ collection: 'users', where: {}, overrideAccess: true })
  // Кеш установленных модулей прочитан при старте — до очистки, перечитываем.
  const { refreshInstalled } = await import('../../src/modules/lifecycle')
  await refreshInstalled(payload)
  const user = await payload.create({
    collection: 'users',
    // Роль не задаём: первый пользователь ячейки должен стать владельцем сам.
    // В типах роль обязательна, поэтому данные приводим явно.
    data: { email: 'owner@test.local', password: 'test-password-1' } as never,
    overrideAccess: true,
  })
  owner = { ...user, collection: 'users' }
}, 120_000)

afterAll(async () => {
  await payload?.destroy()
  rmSync(licenseDir, { recursive: true, force: true })
})

describe('пользователи ячейки', () => {
  it('первый пользователь становится владельцем', () => {
    expect(owner.role).toBe('owner')
  })
})

describe('безопасный запуск (safe mode)', () => {
  it('ядро поднимается, упавший модуль помечен failed, остальные работают', async () => {
    const { modulesSnapshot } = await import('../../src/modules/endpoints')
    const byId = Object.fromEntries(modulesSnapshot().map((m) => [m.id, m]))
    expect(byId.broken?.status).toBe('failed')
    expect(byId.broken?.reason).toContain('модуль сломан при запуске')
    expect(byId.forms?.status).toBe('active')
  })

  it('упавший модуль нельзя установить', async () => {
    const { installModule } = await import('../../src/modules/lifecycle')
    await expect(installModule(payload, 'broken')).rejects.toThrow('Модуль не работает')
  })
})

describe('kill switch', () => {
  it('выключенный Платформой модуль нельзя установить', async () => {
    const { installModule } = await import('../../src/modules/lifecycle')
    await expect(installModule(payload, 'killed')).rejects.toThrow('kill switch')
  })
})

describe('установка и удаление (ADR-013)', () => {
  let formId: number | string

  it('до установки маршруты модуля отвечают 503, данные недоступны', async () => {
    expect((await callEndpoint('post', '/m/forms/1/submit', {})).status).toBe(503)
    await expect(payload.find({ collection: 'forms', user: owner, ...ownerApi })).rejects.toThrow()
  })

  it('зависимость проверяется при установке', async () => {
    const { installModule } = await import('../../src/modules/lifecycle')
    await expect(installModule(payload, 'addon')).rejects.toThrow('Сначала установите: forms')
  })

  it('после установки модуль работает', async () => {
    const { installModule } = await import('../../src/modules/lifecycle')
    await installModule(payload, 'forms')
    const form = await payload.create({
      collection: 'forms',
      data: { title: 'Звонок', fields: [{ name: 'phone', label: 'Телефон', type: 'phone', required: true }] },
      user: owner,
      ...ownerApi,
    })
    formId = form.id
    const res = await callEndpoint('post', `/m/forms/${formId}/submit`, { phone: '+79001234567' })
    expect(res.status).toBe(201)
  })

  it('нельзя удалить модуль, от которого зависит установленный', async () => {
    const { installModule, uninstallModule } = await import('../../src/modules/lifecycle')
    await installModule(payload, 'addon')
    await expect(uninstallModule(payload, 'forms')).rejects.toThrow('От модуля зависят: addon')
    await uninstallModule(payload, 'addon')
  })

  it('удаление выключает модуль, но сохраняет данные', async () => {
    const { uninstallModule } = await import('../../src/modules/lifecycle')
    await uninstallModule(payload, 'forms')
    expect((await callEndpoint('post', `/m/forms/${formId}/submit`, { phone: '+79001234567' })).status).toBe(
      503,
    )
    const kept = await payload.count({ collection: 'forms-submissions', overrideAccess: true })
    expect(kept.totalDocs).toBe(1)
  })

  it('повторная установка возвращает модуль с прежними данными', async () => {
    const { installModule } = await import('../../src/modules/lifecycle')
    await installModule(payload, 'forms')
    const { totalDocs } = await payload.count({ collection: 'forms-submissions', user: owner, ...ownerApi })
    expect(totalDocs).toBe(1)
  })
})

describe('события через очередь', () => {
  it('заявка ставит событие, worker доставляет его подписчику', async () => {
    const forms = await payload.find({ collection: 'forms', overrideAccess: true, limit: 1 })
    await callEndpoint('post', `/m/forms/${forms.docs[0]?.id}/submit`, { phone: '+79007654321' })
    // Раздача и доставка — две задачи: два прохода очереди, как два тика worker.
    await payload.jobs.run({ allQueues: true, overrideAccess: true })
    await payload.jobs.run({ allQueues: true, overrideAccess: true })
    const last = await payload.find({
      collection: 'forms-submissions',
      sort: '-createdAt',
      limit: 1,
      overrideAccess: true,
    })
    expect(last.docs[0]?.notifiedAt).toBeTruthy()
  })
})

describe('бюджет фильтров', () => {
  it('медленный фильтр пропускается, запрос не ждёт, модуль degraded', async () => {
    const { installModule } = await import('../../src/modules/lifecycle')
    const { applyFilter } = await import('../../src/modules/filters')
    const { registry } = await import('../../src/modules/registry')
    await installModule(payload, 'slow')
    const started = performance.now()
    const meta = await applyFilter('page.meta', { title: 'Главная' })
    expect(performance.now() - started).toBeLessThan(150)
    expect(meta).toEqual({ title: 'Главная' })
    expect(registry.get('slow')?.status).toBe('degraded')
  })
})

describe('изоляция данных модуля', () => {
  it('SDK не выдаёт модулю чужие коллекции и события', async () => {
    const { createRuntime } = await import('../../src/modules/runtime')
    const { registry } = await import('../../src/modules/registry')
    const rt = createRuntime(registry.get('forms')!, await createPayloadRequest({ payload }))
    expect(() => rt.data('pages')).toThrow('не владеет коллекцией')
    expect(() => rt.data('users')).toThrow('не владеет коллекцией')
    await expect(rt.publish('pages.published.v1', {})).rejects.toThrow('не объявил событие')
  })

  it('таблицы модуля лежат в его пространстве mod_<id>_', async () => {
    const result = await payload.db.drizzle.execute(
      "select table_name from information_schema.tables where table_name like 'mod_forms_%' order by 1",
    )
    const tables = (result as unknown as { rows: { table_name: string }[] }).rows.map((r) => r.table_name)
    expect(tables).toContain('mod_forms_submissions')
    expect(tables).toContain('mod_forms_settings')
  })
})

describe('лицензия (ADR-008)', () => {
  it('истёкшая лицензия: чтение есть, записи нет, сайт принимает заявки', async () => {
    licenses.issue('forms', 'forms-pro', -30)
    // Лицензия кешируется по времени изменения файла — сдвигаем его наверняка.
    await new Promise((resolve) => setTimeout(resolve, 20))
    licenses.issue('forms', 'forms-pro', -30)
    const forms = await payload.find({ collection: 'forms', user: owner, ...ownerApi })
    expect(forms.totalDocs).toBe(1)
    await expect(
      payload.update({
        collection: 'forms',
        id: forms.docs[0]!.id,
        data: { title: 'Новое' },
        user: owner,
        ...ownerApi,
      }),
    ).rejects.toThrow()
    const res = await callEndpoint('post', `/m/forms/${forms.docs[0]!.id}/submit`, { phone: '+79001112233' })
    expect(res.status).toBe(201)
  })
})
