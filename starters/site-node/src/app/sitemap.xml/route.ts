import { cms } from '@/cms'

export const dynamic = 'force-static'

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

export async function GET() {
  const data = await cms.sitemap()
  const urls = (data?.entries ?? []).map((e) =>
    [
      '  <url>',
      `    <loc>${escape(`${data!.site.url}${e.path === '/' ? '/' : e.path}`)}</loc>`,
      e.lastmod && `    <lastmod>${e.lastmod}</lastmod>`,
      e.changefreq && `    <changefreq>${e.changefreq}</changefreq>`,
      e.priority !== undefined && `    <priority>${e.priority.toFixed(1)}</priority>`,
      '  </url>',
    ]
      .filter(Boolean)
      .join('\n'),
  )
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
}
