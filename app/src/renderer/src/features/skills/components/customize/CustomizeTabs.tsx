import { useI18n } from '../../../../shared/i18n'
import { CATALOG_TABS, type CatalogTab } from '../../lib/catalogSelection'

export function CustomizeTabs({
  id,
  tab,
  onSelect
}: {
  id: string
  tab: CatalogTab
  onSelect: (tab: CatalogTab) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div
      role="tablist"
      aria-label={tr('skills.pageTitle')}
      className="flex gap-1"
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const current = CATALOG_TABS.findIndex((item) => item.tab === tab)
        const index =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? CATALOG_TABS.length - 1
              : (current + (event.key === 'ArrowRight' ? 1 : -1) + CATALOG_TABS.length) %
                CATALOG_TABS.length
        const next = CATALOG_TABS[index].tab
        onSelect(next)
        event.currentTarget
          .querySelector<HTMLButtonElement>(`[data-extensions-tab=${next}]`)
          ?.focus()
      }}
    >
      {CATALOG_TABS.map((item) => (
        <button
          key={item.tab}
          type="button"
          role="tab"
          id={`${id}-${item.tab}`}
          data-extensions-tab={item.tab}
          aria-selected={tab === item.tab}
          aria-controls={`${id}-items`}
          tabIndex={tab === item.tab ? 0 : -1}
          onClick={() => onSelect(item.tab)}
          className={`rounded-r4 px-3 py-1.5 text-footnote transition-colors hide-focus-ring ring-focus ${tab === item.tab ? 'bg-fill-uncontained-active font-medium text-ink' : 'text-ink3 hover:bg-fill-uncontained-hover hover:text-ink'}`}
        >
          {tr(item.labelKey)}
        </button>
      ))}
    </div>
  )
}
