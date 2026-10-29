'use client'

import React, { useState } from 'react'

export const LicenseModal = ({ title, reason }: { title: string; reason: string }) => {
  const [open, setOpen] = useState(true)

  if (!open) {
    return (
      <div className="renote-banner renote-banner--danger">
        Модуль «{title}» заблокирован, данные доступны только для просмотра.{' '}
        <button type="button" className="renote-link" onClick={() => setOpen(true)}>
          Подробнее
        </button>
      </div>
    )
  }

  return (
    <div className="renote-modal" role="dialog" aria-modal="true" aria-labelledby="renote-modal-title">
      <div className="renote-modal__card">
        <h2 id="renote-modal-title">Модуль «{title}» заблокирован</h2>
        <p>{reason}</p>
        <p>
          Данные модуля сохранены и доступны для просмотра, но изменить их нельзя. На сайте модуль продолжает
          работать.
        </p>
        <div className="renote-modal__actions">
          <a className="renote-button renote-button--primary" href="mailto:support@renote.studio">
            Продлить
          </a>
          <button type="button" className="renote-button" onClick={() => setOpen(false)}>
            Только просмотр
          </button>
        </div>
      </div>
    </div>
  )
}
