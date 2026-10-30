// Теги кеша сайта. Тот же список — в ядре (core/src/site/revalidate.ts):
// ядро после публикации сообщает, какие теги сбросить.
export const tags = {
  all: 'cms',
  page: (path: string) => `page:${path}`,
  pages: 'pages',
  settings: 'settings',
  modules: 'modules',
  module: (id: string) => `module:${id}`,
}
