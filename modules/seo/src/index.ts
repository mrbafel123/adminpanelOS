import { defineModule } from '@renote/module-sdk'

import { buildBreadcrumbs, buildMeta, buildRobots, buildSitemap, type SeoSettings } from './lib/seo'

export default defineModule({
  setup: () => ({
    // Группа «SEO» в каждой странице.
    fields: {
      pages: [
        {
          name: 'title',
          type: 'text',
          localized: true,
          label: 'Заголовок для поисковиков',
          admin: { description: 'Если пусто — заголовок страницы по шаблону из настроек SEO' },
        },
        { name: 'description', type: 'textarea', localized: true, label: 'Описание для поисковиков' },
        { name: 'ogImage', type: 'upload', relationTo: 'media', label: 'Картинка для соцсетей' },
        {
          type: 'row',
          fields: [
            { name: 'noindex', type: 'checkbox', label: 'Не индексировать' },
            { name: 'nofollow', type: 'checkbox', label: 'Не переходить по ссылкам' },
          ],
        },
        {
          name: 'canonical',
          type: 'text',
          label: 'Канонический адрес',
          admin: { description: 'Только если отличается' },
        },
        { name: 'jsonLd', type: 'json', label: 'Разметка JSON-LD', admin: { description: 'Для опытных' } },
      ],
    },

    filters: {
      'page.meta': async (meta, { page, site }, ctx) =>
        buildMeta(meta, page, site, (await ctx.settings()) as SeoSettings),
      'page.breadcrumbs': async (crumbs, _args, ctx) =>
        buildBreadcrumbs(crumbs, (await ctx.settings()) as SeoSettings),
      'sitemap.entries': async (entries, { pages }, ctx) =>
        buildSitemap(entries, pages, (await ctx.settings()) as SeoSettings),
      'site.robots': async (lines, { site }, ctx) =>
        buildRobots(lines, site, (await ctx.settings()) as SeoSettings),
    },
  }),
})
