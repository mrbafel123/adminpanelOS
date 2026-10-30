import { RichText } from '@renote/site-sdk/rich-text'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { cms } from '@/cms'

type Props = { params: Promise<{ slug: string }> }

// Документы модуля legal: /legal/privacy и другие.
export const generateStaticParams = async () =>
  (await cms.legalDocuments().catch(() => [])).map((d) => ({ slug: d.slug }))

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const doc = await cms.legalDocument((await params).slug)
  return doc ? { title: doc.title } : {}
}

export default async function LegalPage({ params }: Props) {
  const doc = await cms.legalDocument((await params).slug)
  if (!doc) notFound()
  return (
    <main className="legal">
      <h1 className="page-title">{doc.title}</h1>
      <p className="muted">Редакция от {new Date(doc.updatedAt).toLocaleDateString('ru-RU')}</p>
      <RichText data={doc.content as never} />
    </main>
  )
}
