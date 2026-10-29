'use client'

import { Link, NavGroup, usePathname } from '@payloadcms/ui'
import React from 'react'

const LINKS = [{ href: '/admin/modules', label: 'Модули' }]

export const NavLinks = () => {
  const pathname = usePathname()
  return (
    <NavGroup label="Ячейка">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`nav__link${pathname === link.href ? ' active' : ''}`}
        >
          <span className="nav__link-label">{link.label}</span>
        </Link>
      ))}
    </NavGroup>
  )
}
