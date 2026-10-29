import { SetStepNav } from '@payloadcms/ui'
import { DefaultTemplate } from '@payloadcms/ui/rsc'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { modulesSnapshot } from '../endpoints'
import { ModuleActions } from './ModuleActions'

const STATUS: Record<string, string> = {
  active: 'Работает',
  degraded: 'Деградировал',
  failed: 'Не запустился',
  disabled: 'Отключён Платформой',
}

const LICENSE: Record<string, string> = {
  free: 'Бесплатный',
  valid: 'Действует',
  grace: 'Льготный период',
  expired: 'Истекла',
  missing: 'Нет лицензии',
  invalid: 'Недействительна',
}

export const ModulesView = ({ initPageResult, params, searchParams }: AdminViewServerProps) => {
  const { req, visibleEntities, permissions, locale } = initPageResult
  const isOwner = (req.user as { role?: string } | null)?.role === 'owner'

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <SetStepNav nav={[{ label: 'Модули' }]} />
      <div className="renote-page">
        <h1 className="renote-title">Модули</h1>
        <table className="renote-table">
          <thead>
            <tr>
              <th>Модуль</th>
              <th>Состояние</th>
              <th>Лицензия</th>
              <th>Что происходит при сбое</th>
              {isOwner && <th />}
            </tr>
          </thead>
          <tbody>
            {modulesSnapshot().map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.name}</strong>{' '}
                  <span className="renote-muted">
                    {m.id} {m.version}
                  </span>
                </td>
                <td>
                  {m.installed ? (
                    <span className={`renote-status renote-status--${m.status}`}>{STATUS[m.status]}</span>
                  ) : (
                    <span className="renote-muted">Не установлен</span>
                  )}
                  {m.reason && <div className="renote-muted">{m.reason}</div>}
                </td>
                <td>{LICENSE[m.license.state]}</td>
                <td className="renote-muted">{m.degradation}</td>
                {isOwner && (
                  <td>
                    <ModuleActions moduleId={m.id} installed={m.installed} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DefaultTemplate>
  )
}
