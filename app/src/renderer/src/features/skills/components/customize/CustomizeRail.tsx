import { Rail, RailItem } from '../../../../shared/ui/Rail'
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
    <Rail title={tr('skills.pageTitle')}>
      {CATALOG_TABS.map((it) => (
        <RailItem
          key={it.tab}
          icon={it.icon}
          label={tr(it.labelKey)}
          active={tab === it.tab}
          onClick={() => onSelect(it.tab)}
        />
      ))}
    </Rail>
  )
}
