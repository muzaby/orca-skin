import { useI18n } from '../../../../shared/i18n'
import { CatalogTabs } from '../../../../shared/ui/CatalogTabs'
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
    <CatalogTabs
      id={id}
      label={tr('skills.pageTitle')}
      value={tab}
      items={CATALOG_TABS.map((item) => ({ value: item.tab, label: tr(item.labelKey) }))}
      onChange={onSelect}
      marker="data-extensions-tab"
    />
  )
}
