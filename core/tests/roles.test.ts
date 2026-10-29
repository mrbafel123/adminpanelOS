import type { AccessArgs } from 'payload'
import { describe, expect, it } from 'vitest'

import { canEdit, isOwner, publishedOrLoggedIn } from '../src/access/roles'

const as = (role?: string) => ({ req: { user: role ? { id: 1, role } : null } }) as unknown as AccessArgs

describe('роли ячейки', () => {
  it('редактировать могут владелец и редактор', () => {
    expect(canEdit(as('owner'))).toBe(true)
    expect(canEdit(as('editor'))).toBe(true)
    expect(canEdit(as('viewer'))).toBe(false)
    expect(canEdit(as())).toBe(false)
  })

  it('управлять пользователями может только владелец', () => {
    expect(isOwner(as('owner'))).toBe(true)
    expect(isOwner(as('editor'))).toBe(false)
  })

  it('аноним видит только опубликованное', () => {
    expect(publishedOrLoggedIn(as())).toEqual({ _status: { equals: 'published' } })
    expect(publishedOrLoggedIn(as('viewer'))).toBe(true)
  })
})
