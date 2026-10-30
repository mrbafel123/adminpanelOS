import type { LegalDocumentSummary } from '@renote/site-sdk'
import type { Form, Media, Page } from '@renote/site-sdk/content'
import { RichText } from '@renote/site-sdk/rich-text'
import React from 'react'

import { cms } from '@/cms'
import { FormBlock } from './FormBlock'

type Block = NonNullable<Page['layout']>[number]

// Связь приходит либо id, либо документом — в зависимости от глубины запроса.
const doc = <T extends object>(value: number | T | null | undefined) =>
  value && typeof value === 'object' ? value : undefined

const renderBlock = (block: Block, consentDocs: LegalDocumentSummary[]) => {
  // switch по типу блока проверяется компилятором: новый блок в ядре без поддержки
  // на сайте — ошибка сборки, а не пустое место на странице.
  switch (block.blockType) {
    case 'hero': {
      const image = doc<Media>(block.image)
      return (
        <section className="hero">
          <h1>{block.heading}</h1>
          {block.subheading && <p className="lead">{block.subheading}</p>}
          {block.cta?.url && (
            <a className="button" href={block.cta.url}>
              {block.cta.label ?? 'Подробнее'}
            </a>
          )}
          {image?.url && (
            <img src={cms.mediaUrl(image.variants?.wide?.url ?? image.url)} alt={image.alt ?? ''} />
          )}
        </section>
      )
    }
    case 'content':
      return (
        <section className="section">
          <RichText data={block.body as never} />
        </section>
      )
    case 'faq':
      return (
        <section className="section">
          {(block.items ?? []).map((item) => (
            <details key={item.id} className="faq">
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </section>
      )
    case 'forms-form': {
      // Блок модуля «Формы». Модуль выключен — ядро не отдаёт блок вовсе.
      const form = doc<Form>(block.form)
      return form ? <FormBlock form={form} consentDocs={consentDocs} /> : null
    }
    default: {
      const unknown: never = block
      return unknown
    }
  }
}

export const Blocks = ({
  layout,
  consentDocs,
}: {
  layout: Page['layout']
  consentDocs: LegalDocumentSummary[]
}) => (
  <>
    {(layout ?? []).map((block, i) => (
      <React.Fragment key={block.id ?? i}>{renderBlock(block, consentDocs)}</React.Fragment>
    ))}
  </>
)
