import React from 'react'

// Минимальный рендер JSON редактора Lexical без зависимостей от Payload.
type Node = {
  type: string
  tag?: string
  text?: string
  format?: number
  listType?: 'bullet' | 'number'
  url?: string
  fields?: { url?: string; newTab?: boolean }
  children?: Node[]
}

const BOLD = 1
const ITALIC = 2

const renderText = (node: Node, key: number) => {
  let el: React.ReactNode = node.text
  if ((node.format ?? 0) & BOLD) el = <strong>{el}</strong>
  if ((node.format ?? 0) & ITALIC) el = <em>{el}</em>
  return <React.Fragment key={key}>{el}</React.Fragment>
}

const renderNodes = (nodes: Node[] = []): React.ReactNode =>
  nodes.map((node, i) => {
    const children = renderNodes(node.children)
    switch (node.type) {
      case 'text':
        return renderText(node, i)
      case 'linebreak':
        return <br key={i} />
      case 'heading': {
        const Tag = (node.tag ?? 'h2') as 'h2'
        return <Tag key={i}>{children}</Tag>
      }
      case 'list':
        return node.listType === 'number' ? <ol key={i}>{children}</ol> : <ul key={i}>{children}</ul>
      case 'listitem':
        return <li key={i}>{children}</li>
      case 'quote':
        return <blockquote key={i}>{children}</blockquote>
      case 'link':
      case 'autolink':
        return (
          <a key={i} href={node.fields?.url ?? node.url} target={node.fields?.newTab ? '_blank' : undefined}>
            {children}
          </a>
        )
      default:
        return <p key={i}>{children}</p>
    }
  })

export const RichText = ({ data }: { data?: { root?: { children?: Node[] } } | null }) =>
  data?.root ? <div className="rich-text">{renderNodes(data.root.children)}</div> : null
