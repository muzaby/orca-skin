import { Icon, type IconName } from '../../../../shared/ui/Icon'
import { useI18n, type MessageKey } from '../../../../shared/i18n'
import type { CustomizeTab } from '../../store/extensionsModalStore'

// 라벨은 키만 두고 렌더에서 tr() 해석(0096 패턴). 'MCP' 는 고유명이지만 키로 일관 관리.
const NAV: { tab: CustomizeTab; icon: IconName; labelKey: MessageKey }[] = [
  { tab: 'skills', icon: 'doc', labelKey: 'skills.rail.skills' },
  { tab: 'connectors', icon: 'link', labelKey: 'skills.rail.connectors' },
  { tab: 'plugins', icon: 'layers', labelKey: 'skills.rail.plugins' }
]

export function CustomizeRail({
  tab,
  onSelect
}: {
  tab: CustomizeTab
  onSelect: (tab: CustomizeTab) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <nav className="flex w-[210px] flex-none flex-col gap-1 border-r border-border bg-sidebar p-3">
      <div className="px-2 pb-2 pt-1 font-serif text-[15px] font-semibold text-ink">
        {tr('skills.modalTitle')}
      </div>
      {NAV.map((it) => {
        const active = tab === it.tab
        return (
          <button
            key={it.tab}
            type="button"
            onClick={() => onSelect(it.tab)}
            aria-current={active ? 'page' : undefined}
            className={`flex w-full cursor-pointer items-center gap-2.5 rounded-r4 border-0 px-2.5 py-1.5 text-left text-[13px] transition-colors ${
              active
                ? 'bg-selected-soft font-medium text-selected'
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
