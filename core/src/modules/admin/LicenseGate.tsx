import React from 'react'

import { checkLicense, graceDaysLeft } from '../license'
import { registry } from '../registry'
import { LicenseModal } from './LicenseModal'

// Серверный компонент над списком и документом модуля (ADR-008):
// льготный период — предупреждение, истёкшая лицензия — модальное окно и только чтение.
export const LicenseGate = ({ moduleId }: { moduleId: string }) => {
  const entry = registry.get(moduleId)
  if (!entry) return null
  const title = entry.manifest.name
  const license = checkLicense(entry.manifest)

  if (license.state === 'free' || license.state === 'valid') return null

  if (license.state === 'grace') {
    const left = graceDaysLeft(license.license)
    return (
      <div className="renote-banner renote-banner--warning">
        Лицензия модуля «{title}» истекла. Через {left} дн. модуль перейдёт в режим только для чтения.
      </div>
    )
  }

  const reason =
    'reason' in license
      ? license.reason
      : `Срок лицензии закончился ${new Date(license.license.validUntil).toLocaleDateString('ru-RU')}.`
  return <LicenseModal title={title} reason={reason} />
}
