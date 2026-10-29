import { defineModule } from '@renote/module-sdk'

import { validateSubmission, type FormField } from './protected'

export default defineModule({
  setup: ({ slug }) => ({
    collections: [
      {
        name: 'forms',
        labels: { singular: 'Форма', plural: 'Формы' },
        admin: { useAsTitle: 'title' },
        // Описание формы публичное: сайт рисует её без входа. Заявки закрыты.
        access: { read: () => true },
        fields: [
          { name: 'title', type: 'text', required: true, label: 'Название' },
          {
            name: 'fields',
            type: 'array',
            label: 'Поля',
            labels: { singular: 'поле', plural: 'Поля' },
            fields: [
              { name: 'name', type: 'text', required: true, label: 'Ключ' },
              { name: 'label', type: 'text', required: true, localized: true, label: 'Подпись' },
              {
                name: 'type',
                type: 'select',
                required: true,
                defaultValue: 'text',
                label: 'Тип',
                options: [
                  { label: 'Строка', value: 'text' },
                  { label: 'Email', value: 'email' },
                  { label: 'Телефон', value: 'phone' },
                  { label: 'Текст', value: 'textarea' },
                  { label: 'Галочка', value: 'checkbox' },
                ],
              },
              { name: 'required', type: 'checkbox', label: 'Обязательное' },
            ],
          },
          { name: 'successMessage', type: 'text', localized: true, label: 'Текст после отправки' },
        ],
      },
      {
        name: 'submissions',
        labels: { singular: 'Заявка', plural: 'Заявки' },
        admin: { useAsTitle: 'createdAt', defaultColumns: ['form', 'status', 'createdAt'] },
        versions: false,
        fields: [
          { name: 'form', type: 'relationship', relationTo: slug('forms'), required: true, label: 'Форма' },
          { name: 'data', type: 'json', label: 'Данные' },
          {
            name: 'status',
            type: 'select',
            defaultValue: 'new',
            label: 'Статус',
            options: [
              { label: 'Новая', value: 'new' },
              { label: 'В работе', value: 'progress' },
              { label: 'Закрыта', value: 'done' },
            ],
          },
          { name: 'ip', type: 'text', label: 'IP', admin: { readOnly: true } },
          { name: 'notifiedAt', type: 'date', label: 'Уведомление отправлено', admin: { readOnly: true } },
        ],
      },
    ],

    blocks: [
      {
        name: 'form',
        labels: { singular: 'Форма', plural: 'Формы' },
        fields: [
          { name: 'form', type: 'relationship', relationTo: slug('forms'), required: true, label: 'Форма' },
        ],
      },
    ],

    endpoints: [
      {
        // Публичный приём заявок. Работает и при истёкшей лицензии (ADR-008).
        path: '/:formId/submit',
        method: 'post',
        handler: async (req, rt) => {
          const form = await rt.data('forms', { asSystem: true }).findByID(req.params.formId ?? '')
          if (!form) return { status: 404, body: { error: 'Форма не найдена' } }

          const result = validateSubmission((form.fields ?? []) as FormField[], req.body)
          // Боту отвечаем как человеку, но ничего не сохраняем.
          if (result.isSpam) return { body: { ok: true } }
          if (!result.ok) return { status: 422, body: { errors: result.errors } }

          const settings = await rt.settings()
          const submission = await rt.data('submissions', { asSystem: true }).create({
            form: form.id,
            data: result.data,
            ip: settings.storeIp ? req.ip : undefined,
          })
          await rt.publish('forms.submitted.v1', { submissionId: submission.id, formId: form.id })
          return { status: 201, body: { ok: true, message: form.successMessage ?? 'Спасибо!' } }
        },
      },
    ],

    on: {
      'forms.submitted.v1': async ({ submissionId }, rt) => {
        const settings = await rt.settings()
        // Отправка почты появится вместе с почтовым адаптером ячейки, пока — запись в лог.
        rt.log('Уведомление о заявке', { submissionId, to: settings.notifyEmail ?? '(не задан)' })
        await rt.data('submissions', { asSystem: true }).update(submissionId as number, {
          notifiedAt: new Date().toISOString(),
        })
      },
    },
  }),
})
