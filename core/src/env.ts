// Переменные окружения ячейки. Отсутствие обязательной — ошибка при старте,
// а не падение посреди запроса.
const required = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`Не задана переменная окружения ${name}`)
  return value
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  payloadSecret: required('PAYLOAD_SECRET'),
  s3: {
    endpoint: required('S3_ENDPOINT'),
    bucket: required('S3_BUCKET'),
    accessKeyId: required('S3_ACCESS_KEY_ID'),
    secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    region: process.env.S3_REGION ?? 'ru-central1',
  },
  siteOrigins: (process.env.SITE_ORIGINS ?? '').split(',').filter(Boolean),
  isProduction: process.env.NODE_ENV === 'production',
  // web — ядро с админкой и API, worker — процесс очереди задач.
  role: process.env.CELL_ROLE === 'worker' ? 'worker' : 'web',
}
