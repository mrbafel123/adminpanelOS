import { defineConfig } from 'vitest/config'

// Интеграционные тесты: настоящий Payload и Postgres. Один процесс на все файлы —
// Payload кеширует экземпляр глобально.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/int/**/*.int.test.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      PAYLOAD_SECRET: 'test-only',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
      S3_ENDPOINT: 'http://localhost:8333',
      S3_BUCKET: 'test',
      S3_ACCESS_KEY_ID: 'test',
      S3_SECRET_ACCESS_KEY: 'test',
    },
  },
})
