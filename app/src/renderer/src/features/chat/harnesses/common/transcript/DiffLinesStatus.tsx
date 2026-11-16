import { useI18n } from '../../../../../shared/i18n'
import { ArcSpinner } from '../../../../../shared/ui/ArcSpinner'

// 큰 diff 의 줄 계산을 기다리는 동안의 표시 (0324 D-014). 계산은 워커에서 돌아 조작은 막히지 않는다.
export function DiffLinesStatus(): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div role="status" className="flex items-center gap-2 px-3 py-2 text-caption text-t6">
      <ArcSpinner />
      <span>{tr('chat.toolMeta.diffLoading')}</span>
    </div>
  )
}
