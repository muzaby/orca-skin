import { Icon } from '../../../../shared/ui/Icon'

export function ReservedTileContent(): React.JSX.Element {
  return (
    <div className="m-auto flex max-w-[240px] flex-col items-center gap-g3 px-4 text-center text-t6">
      <Icon name="board" size={28} style={{ color: 'var(--color-t6)' }} />
      <p className="text-footnote font-medium text-t6">예약된 타일입니다</p>
      <p className="text-caption text-ink3">이 영역은 다음 보조 패널 기능을 위해 비워두었습니다.</p>
    </div>
  )
}
