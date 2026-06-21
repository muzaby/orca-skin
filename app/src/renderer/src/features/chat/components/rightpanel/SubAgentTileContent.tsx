import { Icon } from '../../../../shared/ui/Icon'

export function SubAgentTileContent(): React.JSX.Element {
  return (
    <div className="m-auto flex max-w-[240px] flex-col items-center gap-g3 px-4 text-center text-t6">
      <Icon name="layers" size={28} style={{ color: 'var(--color-t6)' }} />
      <p className="text-footnote font-medium text-t6">아직 서브 에이전트 출력이 없습니다</p>
      <p className="text-caption text-ink3">후속 작업에서 실행 로그와 결과가 여기에 연결됩니다.</p>
    </div>
  )
}
