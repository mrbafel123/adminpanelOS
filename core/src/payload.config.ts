import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { sharpTransformer } from '@payloadcms/transformer-sharp'
import { en } from '@payloadcms/translations/languages/en'
import { ru } from '@payloadcms/translations/languages/ru'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'

import { Folders } from './collections/Folders'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Users } from './collections/Users'
import { env } from './env'
import { CellRuntime } from './globals/CellRuntime'
import { SiteSettings } from './globals/SiteSettings'
import { healthEndpoint } from './health'
import { migrations } from './migrations'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: dirname },
    meta: { titleSuffix: ' — Renote' },
  },
  i18n: { fallbackLanguage: 'ru', supportedLanguages: { ru, en } },
  localization: {
    locales: [
      { code: 'ru', label: 'Русский' },
      { code: 'en', label: 'English' },
    ],
    defaultLocale: 'ru',
    fallback: true,
  },
  collections: [Pages, Media, Folders, Users],
  globals: [SiteSettings, CellRuntime],
  endpoints: [healthEndpoint],
  editor: lexicalEditor(),
  secret: env.payloadSecret,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: { connectionString: env.databaseUrl },
    // В ячейке схема меняется только миграциями, push — только в dev (ADR-006, ADR-012).
    // В dev схему двигает только веб-процесс, иначе два процесса гоняются за одной базой.
    push: !env.isProduction && env.role === 'web',
    prodMigrations: migrations,
  }),
  // Задачи очереди выполняет только worker: в веб-процессе autoRun не включается (ADR-012).
  jobs: { tasks: [] },
  storage: [
    s3Storage({
      collections: { media: true },
      bucket: env.s3.bucket,
      config: {
        endpoint: env.s3.endpoint,
        region: env.s3.region,
        forcePathStyle: true,
        credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey },
      },
    }),
  ],
  upload: {
    transformers: [
      sharpTransformer({
        collections: {
          media: {
            variants: [
              { name: 'thumb', width: 400 },
              { name: 'card', width: 960 },
              { name: 'wide', width: 1920 },
            ],
            formatOptions: { format: 'webp' },
          },
        },
      }),
    ],
  },
  cors: env.siteOrigins,
})
