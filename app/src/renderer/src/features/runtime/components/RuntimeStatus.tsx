import { Dot, type StatusTone } from '../../../shared/ui/Status'
import { useRuntimeContext } from '../providers/RuntimeProvider'
import type { RuntimeStage } from '../../../../../shared/ipc'

const STAGE_LABEL: Record<RuntimeStage, string> = {
  idle: 'Python 미시작',
  preparing: 'Python 준비 중…',
  ready: 'Python 3.12 준비됨',
  error: 'Python 준비 실패'
}

const STAGE_TONE: Record<RuntimeStage, StatusTone> = {
  idle: 'slate',
  preparing: 'amber',
  ready: 'green',
  error: 'red'
}

// Sidebar footer 슬롯에 주입되는 도메인 위젯. uv 격리 Python 런타임의 준비 상태를
// 표시하고, 클릭 시 상태/로그 모달을 연다. RuntimeContext 자체 구독.
export function RuntimeStatus(): React.JSX.Element {
  const { status, setModalOpen } = useRuntimeContext()
  const stage = status.stage
  return (
    <button
      onClick={() => setModalOpen(true)}
      className="flex w-full items-center gap-1.5 rounded-md border-0 bg-transparent px-1 py-1 text-[10.5px] text-ink3 hover:text-ink2"
      title="Python 런타임 상태"
    >
      <Dot tone={STAGE_TONE[stage]} />
      <span className="truncate">{STAGE_LABEL[stage]}</span>
    </button>
  )
}
