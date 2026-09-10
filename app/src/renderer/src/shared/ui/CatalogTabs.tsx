import type { ReactNode, Ref } from 'react'

interface CatalogTabsProps<T extends string> {
  id: string
  label: string
  value: T
  items: readonly { value: T; label: ReactNode }[]
  onChange: (value: T) => void
  activeTabRef?: Ref<HTMLButtonElement>
  marker: `data-${string}`
}

export function CatalogTabs<T extends string>({
  id,
  label,
  value,
  items,
  onChange,
  activeTabRef,
  marker
}: CatalogTabsProps<T>): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1"
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const current = items.findIndex((item) => item.value === value)
        const index =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : (current + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
        const next = items[index]
        if (!next) return
        onChange(next.value)
        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')[index]?.focus()
      }}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          ref={value === item.value ? activeTabRef : undefined}
          id={`${id}-${item.value}`}
          {...{ [marker]: item.value }}
          aria-selected={value === item.value}
          aria-controls={`${id}-items`}
          tabIndex={value === item.value ? 0 : -1}
          onClick={() => onChange(item.value)}
          className={`rounded-r4 px-3 py-1.5 text-footnote transition-colors hide-focus-ring ring-focus ${value === item.value ? 'bg-fill-uncontained-active font-medium text-ink' : 'text-ink3 hover:bg-fill-uncontained-hover hover:text-ink'}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
