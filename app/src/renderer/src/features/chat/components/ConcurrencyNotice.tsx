import { Icon } from '../../../shared/ui/Icon'

export function ConcurrencyNotice(): React.JSX.Element {
  return (
    <div className="flex items-start gap-2 rounded-r6 border border-accent/30 bg-accent/10 px-3 py-2 text-[12px] leading-relaxed text-ink">
      <Icon name="alert" size={14} />
      <div>
        <div className="font-medium">같은 프로젝트에서 다른 작업이 실행 중입니다.</div>
        <div className="text-ink2">
          파일 충돌 가능성이 있습니다. Orca는 작업을 차단하지 않으며, 동시 실행 여부는 사용자가
          판단합니다.
        </div>
      </div>
    </div>
  )
}
