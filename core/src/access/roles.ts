import type { Access, FieldAccess } from 'payload'

// Роли ячейки: владелец, редактор, наблюдатель.
export const ROLES = ['owner', 'editor', 'viewer'] as const
export type Role = (typeof ROLES)[number]

type WithRole = { role?: Role } | null | undefined

const hasRole = (user: WithRole, roles: Role[]) => !!user?.role && roles.includes(user.role)

export const isLoggedIn: Access = ({ req }) => !!req.user
export const isOwner: Access = ({ req }) => hasRole(req.user as WithRole, ['owner'])
export const canEdit: Access = ({ req }) => hasRole(req.user as WithRole, ['owner', 'editor'])
export const isOwnerField: FieldAccess = ({ req }) => hasRole(req.user as WithRole, ['owner'])

// Опубликованное видят все, черновики — только вошедшие.
export const publishedOrLoggedIn: Access = ({ req }) => {
  if (req.user) return true
  return { _status: { equals: 'published' } }
}
