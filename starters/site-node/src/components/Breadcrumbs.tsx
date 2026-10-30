import type { Breadcrumb } from '@renote/site-sdk'

export const Breadcrumbs = ({ items }: { items: Breadcrumb[] }) =>
  items.length > 1 ? (
    <nav className="breadcrumbs" aria-label="Хлебные крошки">
      {items.map((c, i) =>
        i === items.length - 1 ? (
          <span key={c.path} aria-current="page">
            {c.label}
          </span>
        ) : (
          <a key={c.path} href={c.path}>
            {c.label}
          </a>
        ),
      )}
    </nav>
  ) : null
