import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import { CATALOG_TABS, type CatalogTab } from '../../lib/catalogSelection'

export function CustomizeRail({
  tab,
  onSelect
}: {
  tab: CatalogTab
  onSelect: (tab: CatalogTab) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <nav className="flex w-[200px] flex-none flex-col gap-0.5 border-r border-border px-2.5 py-4">
      {CATALOG_TABS.map((it) => {
        const active = tab === it.tab
        return (
          <button
            key={it.tab}
            type="button"
            onClick={() => onSelect(it.tab)}
            aria-current={active ? 'page' : undefined}
            className={`flex w-full cursor-pointer items-center gap-2.5 rounded-r4 border-0 px-2.5 py-2 text-left text-[13px] transition-colors ${
              active
                ? 'bg-t3 font-medium text-t8'
                : 'bg-transparent text-t7 hover:bg-fill-uncontained-hover hover:text-t9'
            }`}
          >
            <Icon name={it.icon} size={15} />
            <span>{tr(it.labelKey)}</span>
          </button>
        )
      })}
    </nav>
  )
}
