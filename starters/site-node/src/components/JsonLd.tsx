import type { Breadcrumb, PageMeta } from '@renote/site-sdk'

// Разметка schema.org: от модулей (meta.jsonLd) и хлебные крошки.
export const JsonLd = ({
  meta,
  breadcrumbs,
  siteUrl,
}: {
  meta: PageMeta
  breadcrumbs: Breadcrumb[]
  siteUrl: string
}) => {
  const items = [...meta.jsonLd]
  if (breadcrumbs.length > 1) {
    items.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.label,
        item: `${siteUrl}${c.path === '/' ? '' : c.path}`,
      })),
    })
  }
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  )
}
