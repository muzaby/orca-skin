import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

interface CatalogListRowProps extends Omit<HTMLAttributes<HTMLLIElement>, 'title'> {
  icon: ReactNode
  title: ReactNode
  detail?: ReactNode
  trailing?: ReactNode
  actions?: ReactNode
  selected?: boolean
  openProps: ButtonHTMLAttributes<HTMLButtonElement>
}

/** Shared catalog geometry; domains supply content and behavior. */
export function CatalogListRow({
  icon,
  title,
  detail,
  trailing,
  actions,
  selected = false,
  openProps,
  ...props
}: CatalogListRowProps): React.JSX.Element {
  return (
    <li
      {...props}
      className={`group/catalog-row flex min-w-0 items-center gap-2 rounded-r4 px-3 transition-colors ${selected ? 'bg-fill-uncontained-active' : 'hover:bg-fill-uncontained-hover'}`}
    >
      <button
        type="button"
        aria-pressed={selected}
        {...openProps}
        className="flex min-w-0 flex-1 items-center gap-3.5 rounded-r4 py-4 text-left hide-focus-ring ring-focus disabled:opacity-50"
      >
        {icon}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-2 text-[14px] font-medium text-ink">
            {title}
          </span>
          {detail}
        </span>
        {trailing}
      </button>
      {actions}
    </li>
  )
}
