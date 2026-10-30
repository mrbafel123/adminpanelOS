// Демо-контент локальной ячейки для проверки стартера сайта.
//   node test-scripts/site/seed-demo.mjs
// Владелец — из deploy/dev/.env (deploy/dev/create-owner.sh). Повторный запуск ничего не дублирует.
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../../deploy/dev/.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const API = `${process.argv[2] ?? 'http://localhost:3200'}/api`
let token

const call = async (method, path, body) => {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `JWT ${token}` }) },
    body: body && JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(json).slice(0, 300)}`)
  return json
}

const findOne = async (collection, where) =>
  (await call('GET', `/${collection}?${new URLSearchParams(where)}&limit=1&depth=0&draft=true`)).docs[0]

const upsert = async (collection, where, data) =>
  (await findOne(collection, where)) ?? (await call('POST', `/${collection}`, data)).doc

const text = (...paragraphs) => ({
  root: {
    type: 'root',
    version: 1,
    children: paragraphs.map((t) => ({ type: 'paragraph', version: 1, children: [{ type: 'text', text: t, version: 1 }] })),
  },
})

token = (await call('POST', '/users/login', { email: env.DEV_OWNER_EMAIL, password: env.DEV_OWNER_PASSWORD })).token

for (const id of ['forms', 'seo', 'redirects', 'legal']) {
  await call('POST', `/renote/modules/${id}/install`).catch((e) => console.warn(e.message))
}

await call('POST', '/globals/site-settings', {
  siteName: 'Renote Studio',
  contacts: { phone: '+7 495 000-00-00', email: 'hello@renote.test' },
})
await call('POST', '/globals/seo-settings', { titleTemplate: '%s — %site', defaultDescription: 'Сайты, которые работают на бизнес' })
await call('POST', '/globals/forms-settings', { notifyEmail: 'sales@renote.test' })

await upsert('legal-documents', { 'where[slug][equals]': 'privacy' }, {
  title: 'Политика обработки персональных данных',
  slug: 'privacy',
  kind: 'privacy',
  required: true,
  content: text('Мы обрабатываем персональные данные в соответствии с 152-ФЗ.', 'Данные используются только для связи с вами.'),
  _status: 'published',
})

const form = await upsert('forms', { 'where[title][equals]': 'Обратный звонок' }, {
  title: 'Обратный звонок',
  successMessage: 'Перезвоним в течение часа',
  fields: [
    { name: 'name', label: 'Имя', type: 'text', required: true },
    { name: 'phone', label: 'Телефон', type: 'phone', required: true },
  ],
})

await upsert('pages', { 'where[path][equals]': '/' }, {
  title: 'Главная',
  slug: 'home',
  _status: 'published',
  layout: [
    {
      blockType: 'hero',
      heading: 'Сайты, которые работают на бизнес',
      subheading: 'Проектируем, разрабатываем и сопровождаем сайты компаний.',
      cta: { label: 'Обсудить проект', url: '/kontakty' },
    },
    {
      blockType: 'faq',
      items: [
        { question: 'Сколько стоит сайт?', answer: 'От 150 000 ₽, точная оценка после брифа.' },
        { question: 'Сколько длится разработка?', answer: 'Обычно 4–8 недель.' },
      ],
    },
  ],
})
const services = await upsert('pages', { 'where[path][equals]': '/uslugi' }, {
  title: 'Услуги',
  _status: 'published',
  layout: [{ blockType: 'content', body: text('Полный цикл: от брифа до поддержки.') }],
})
await upsert('pages', { 'where[path][equals]': '/uslugi/razrabotka' }, {
  title: 'Разработка',
  parent: services.id,
  _status: 'published',
  seo: { description: 'Разработка уникальных сайтов на современном стеке' },
  layout: [{ blockType: 'content', body: text('Уникальный дизайн и код под задачи бизнеса.') }],
})
await upsert('pages', { 'where[path][equals]': '/kontakty' }, {
  title: 'Контакты',
  _status: 'published',
  layout: [
    { blockType: 'content', body: text('Москва, ул. Примерная, 1. Пн–пт, 10:00–19:00.') },
    { blockType: 'forms-form', form: form.id },
  ],
})

console.log('Демо-контент готов')
