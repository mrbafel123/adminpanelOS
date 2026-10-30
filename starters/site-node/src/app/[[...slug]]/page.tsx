import { CmsUnavailableError, pathFromSegments, segmentsFromPath } from '@renote/site-sdk'
import type { Metadata } from 'next'
import { notFound, permanentRedirect, redirect } from 'next/navigation'

import { cms, isStatic } from '@/cms'
import { Blocks } from '@/components/Blocks'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { JsonLd } from '@/components/JsonLd'
import { RedirectStub } from '@/components/RedirectStub'

type Props = { params: Promise<{ slug?: string[] }> }

// Все опубликованные страницы собираются заранее: если ядро упадёт, сайт отдаст
// готовые страницы. В статике заранее собираются и страницы-редиректы.
export const generateStaticParams = async () => {
  try {
    const [paths, rules] = await Promise.all([cms.paths(), isStatic ? cms.redirects() : []])
    const sources = rules.filter((r) => !paths.includes(r.from)).map((r) => r.from)
    return [...paths, ...sources].map((path) => ({ slug: segmentsFromPath(path) }))
  } catch (e) {
    // Серверный режим соберётся и без ядра: страницы появятся по первому запросу.
    if (!isStatic && e instanceof CmsUnavailableError) {
      console.warn(`Ядро недоступно при сборке, страницы будут собраны по запросу: ${e.message}`)
      return []
    }
    throw e
  }
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const data = await cms.page(pathFromSegments((await params).slug))
  if (!data) return { robots: { index: false } }
  const { meta } = data
  return {
    title: { absolute: meta.title },
    description: meta.description || undefined,
    alternates: { canonical: meta.canonical },
    robots: meta.robots,
    openGraph: {
      title: meta.openGraph.title,
      description: meta.openGraph.description || undefined,
      type: meta.openGraph.type,
      url: meta.canonical,
      images: meta.openGraph.image ? [meta.openGraph.image] : undefined,
    },
  }
}

export default async function Page({ params }: Props) {
  const path = pathFromSegments((await params).slug)
  const data = await cms.page(path)

  if (!data) {
    // Страницы нет — возможно, она переехала (модуль «Редиректы»).
    const rule = await cms.redirect(path)
    if (!rule) notFound()
    if (isStatic) return <RedirectStub to={rule.to} />
    // Next отдаёт 308/307 — для поисковиков это то же, что 301/302.
    return rule.code === 301 || rule.code === 308 ? permanentRedirect(rule.to) : redirect(rule.to)
  }

  const [consentDocs, sitemap] = await Promise.all([cms.legalDocuments(), cms.sitemap()])
  const { page, meta, breadcrumbs } = data
  return (
    <main>
      <JsonLd meta={meta} breadcrumbs={breadcrumbs} siteUrl={sitemap?.site.url ?? ''} />
      <Breadcrumbs items={breadcrumbs} />
      {page.layout?.[0]?.blockType !== 'hero' && <h1 className="page-title">{page.title}</h1>}
      <Blocks layout={page.layout} consentDocs={consentDocs} />
    </main>
  )
}
