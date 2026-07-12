import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'

export function ReservedTileContent(): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div className="m-auto flex max-w-[240px] flex-col items-center gap-g3 px-4 text-center text-t6">
      <Icon name="board" size={28} style={{ color: 'var(--color-t6)' }} />
      <p className="text-footnote font-medium text-t6">{tr('chat.rightpanel.reservedTitle')}</p>
      <p className="text-caption text-ink3">{tr('chat.rightpanel.reservedDesc')}</p>
    </div>
  )
}
