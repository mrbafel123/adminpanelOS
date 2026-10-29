'use client'

import { useRouter } from '@payloadcms/ui'
import React, { useState } from 'react'

// Кнопки установки и удаления модуля. Удаление сохраняет данные (ADR-013).
export const ModuleActions = ({ moduleId, installed }: { moduleId: string; installed: boolean }) => {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (action: 'install' | 'uninstall') => {
    if (
      action === 'uninstall' &&
      !confirm('Модуль скроется из админки и сайта. Данные сохранятся. Продолжить?')
    )
      return
    setBusy(true)
    setError('')
    const res = await fetch(`/api/renote/modules/${moduleId}/${action}`, {
      method: 'POST',
      credentials: 'include',
    })
    setBusy(false)
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'Не получилось')
      return
    }
    router.refresh()
  }

  return (
    <div className="renote-actions">
      <button
        type="button"
        className={`renote-button${installed ? '' : ' renote-button--primary'}`}
        disabled={busy}
        onClick={() => run(installed ? 'uninstall' : 'install')}
      >
        {busy ? '…' : installed ? 'Удалить' : 'Установить'}
      </button>
      {error && <div className="renote-error">{error}</div>}
    </div>
  )
}
