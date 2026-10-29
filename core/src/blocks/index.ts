import type { Block } from 'payload'

// Базовые секции страниц. Уникальные секции сайта клиента и блоки модулей
// добавляются в поле `layout` страниц через custom.renoteBlocks (ADR-003).
export const Hero: Block = {
  slug: 'hero',
  labels: { singular: 'Первый экран', plural: 'Первые экраны' },
  fields: [
    { name: 'heading', type: 'text', required: true, localized: true, label: 'Заголовок' },
    { name: 'subheading', type: 'textarea', localized: true, label: 'Подзаголовок' },
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Картинка' },
    {
      name: 'cta',
      type: 'group',
      label: 'Кнопка',
      fields: [
        { name: 'label', type: 'text', localized: true, label: 'Текст' },
        { name: 'url', type: 'text', label: 'Ссылка' },
      ],
    },
  ],
}

export const Content: Block = {
  slug: 'content',
  labels: { singular: 'Текст', plural: 'Тексты' },
  fields: [{ name: 'body', type: 'richText', localized: true, label: 'Текст' }],
}

export const Faq: Block = {
  slug: 'faq',
  labels: { singular: 'Вопросы и ответы', plural: 'Вопросы и ответы' },
  fields: [
    {
      name: 'items',
      type: 'array',
      label: 'Вопросы',
      labels: { singular: 'вопрос', plural: 'Вопросы' },
      fields: [
        { name: 'question', type: 'text', required: true, localized: true, label: 'Вопрос' },
        { name: 'answer', type: 'textarea', required: true, localized: true, label: 'Ответ' },
      ],
    },
  ],
}

export const pageBlocks = [Hero, Content, Faq]
