import js from '@eslint/js'
import tseslint from 'typescript-eslint'

// Модуль работает с ядром только через @renote/module-sdk (ADR-003, ADR-012).
// Внутри процесса это не барьер, а правило ревью и CI: нарушение — ошибка линтера.
export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['payload', 'payload/*', '@payloadcms/*', 'drizzle-orm', 'drizzle-orm/*', 'pg'],
            message: 'Модуль работает с ядром и базой только через @renote/module-sdk.',
          },
          {
            group: ['@renote/core', '@renote/core/*', '**/core/src/**'],
            message: 'Модуль не импортирует внутренности ядра.',
          },
          {
            group: ['@renote/module-*', '!@renote/module-sdk', '!@renote/module-sdk/*'],
            message: 'Связь с другими модулями — через события, не импортом.',
          },
        ],
      },
    ],
  },
})
