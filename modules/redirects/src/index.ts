import { CORE_EVENTS, defineModule, type ModuleRuntime } from '@renote/module-sdk'

import {
  createsCycle,
  normalizePath,
  normalizeTarget,
  parseImport,
  planPathChange,
  resolve,
  type Rule,
} from './lib/redirects'

const loadRules = async (rt: ModuleRuntime) =>
  (await rt.data('rules', { asSystem: true }).find({ limit: 10_000 })) as unknown as (Rule & { id: number })[]

const toRule = (doc: Record<string, unknown>): Rule => ({
  from: String(doc.from),
  to: String(doc.to),
  code: Number(doc.code) as Rule['code'],
  active: doc.active as boolean,
})

export default defineModule({
  setup: () => ({
    collections: [
      {
        name: 'rules',
        labels: { singular: 'Редирект', plural: 'Редиректы' },
        admin: { useAsTitle: 'from', defaultColumns: ['from', 'to', 'code', 'source', 'active'] },
        versions: false,
        // Правила нужны сайту без входа: middleware перенаправляет посетителей.
        access: { read: () => true },
        hooks: {
          beforeValidate: [
            ({ data }) =>
              data && {
                ...data,
                ...(typeof data.from === 'string' && { from: normalizePath(data.from) }),
                ...(typeof data.to === 'string' && { to: normalizeTarget(data.to) }),
              },
          ],
          // Цикл проверяется по всем правилам модуля до сохранения.
          beforeChange: [
            async ({ data, req, collection }) => {
              const { docs } = await req.payload.find({
                collection: collection.slug as never,
                limit: 10_000,
                depth: 0,
                overrideAccess: true,
                req,
              })
              if (
                data.active !== false &&
                createsCycle(
                  toRule(data),
                  docs.map((d) => toRule(d as never)),
                )
              ) {
                throw new Error(`Редирект ${data.from} → ${data.to} замыкает цепочку в цикл`)
              }
              return data
            },
          ],
        },
        fields: [
          { name: 'from', type: 'text', required: true, unique: true, index: true, label: 'Откуда' },
          {
            name: 'to',
            type: 'text',
            required: true,
            label: 'Куда',
            admin: { description: 'Путь сайта или полный адрес' },
          },
          {
            name: 'code',
            type: 'select',
            required: true,
            defaultValue: '301',
            label: 'Код',
            options: [
              { label: '301 — навсегда', value: '301' },
              { label: '302 — временно', value: '302' },
              { label: '307 — временно, с методом', value: '307' },
              { label: '308 — навсегда, с методом', value: '308' },
            ],
          },
          { name: 'active', type: 'checkbox', defaultValue: true, label: 'Включён' },
          {
            name: 'source',
            type: 'select',
            defaultValue: 'manual',
            label: 'Источник',
            options: [
              { label: 'Вручную', value: 'manual' },
              { label: 'Смена адреса страницы', value: 'auto' },
              { label: 'Импорт', value: 'import' },
            ],
            admin: { readOnly: true, position: 'sidebar' },
          },
        ],
      },
    ],

    endpoints: [
      {
        // Все включённые правила — сайт кеширует их и перенаправляет без запроса к ядру.
        path: '/rules',
        method: 'get',
        handler: async (_req, rt) => {
          const rules = (await loadRules(rt)).filter((r) => r.active !== false)
          return { body: rules.map(({ from, to, code }) => ({ from, to, code: Number(code) })) }
        },
      },
      {
        path: '/resolve',
        method: 'get',
        handler: async (req, rt) => {
          const path = String(req.query.path ?? '/')
          const result = resolve(path, (await loadRules(rt)).map(toRule))
          if (!result) return { status: 404, body: { error: 'Редиректа нет' } }
          if ('error' in result) return { status: 508, body: { error: 'Цикл редиректов' } }
          return { body: result }
        },
      },
      {
        path: '/import',
        method: 'post',
        handler: async (req, rt) => {
          if (!req.user || !['owner', 'editor'].includes(req.user.role ?? '')) {
            return { status: 403, body: { error: 'Импорт доступен редактору и владельцу' } }
          }
          const { rules, errors } = parseImport(String((req.body as { text?: string })?.text ?? ''))
          const existing = new Set((await loadRules(rt)).map((r) => r.from))
          let created = 0
          for (const rule of rules) {
            if (existing.has(rule.from)) {
              errors.push(`${rule.from}: правило уже есть`)
              continue
            }
            try {
              await rt.data('rules').create({ ...rule, code: String(rule.code), source: 'import' })
              existing.add(rule.from)
              created++
            } catch (e) {
              errors.push(`${rule.from}: ${(e as Error).message}`)
            }
          }
          return { body: { created, errors } }
        },
      },
    ],

    on: {
      // Страница сменила адрес — старые ссылки и позиции в поиске не должны пропасть.
      [CORE_EVENTS.pagePathChanged]: async ({ from, to }, rt) => {
        const rules = await loadRules(rt)
        const plan = planPathChange(String(from), String(to), rules)
        const data = rt.data('rules', { asSystem: true })
        for (const path of plan.remove) {
          const rule = rules.find((r) => r.from === path)
          if (rule) await data.update(rule.id, { active: false })
        }
        for (const { from: source, to: target } of plan.retarget) {
          const rule = rules.find((r) => r.from === source)
          if (rule) await data.update(rule.id, { to: target })
        }
        if (plan.create) await data.create({ ...plan.create, code: String(plan.create.code), source: 'auto' })
        rt.log('Редиректы после смены адреса страницы', { from, to, ...plan })
      },
    },
  }),
})
