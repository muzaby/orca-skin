import { Icon } from '../../../../shared/ui/Icon'
import type { TaskBoardStatus } from '../../lib/taskBoard'

// 상태 원형 아이콘 — 첨부 디자인(원형 배지 + ✓/↻/번호)을 시맨틱 토큰으로 옮긴 것이다.
// raw hex 를 쓰지 않으므로 두 테마에서 함께 따라온다(renderer/AGENTS §스타일).
//
// `index` 는 대기 중 항목의 순번(첨부 양식의 `4`·`5`) — 목록 안 위치를 1부터 센 값이다.
interface TaskStatusIconProps {
  status: TaskBoardStatus
  index: number
}

const BASE = 'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full mt-px'

export function TaskStatusIcon({ status, index }: TaskStatusIconProps): React.JSX.Element {
  switch (status) {
    case 'completed':
      return (
        <span
          className={`${BASE} bg-[color-mix(in_srgb,var(--color-good)_18%,transparent)] text-good`}
        >
          <Icon name="check" size={11} />
        </span>
      )
    case 'in_progress':
    case 'stopping':
      return (
        <span
          className={`${BASE} ${
            status === 'stopping'
              ? 'bg-fill-uncontained-hover text-t6'
              : 'bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-accent'
          }`}
        >
          {/* 진행 표시는 회전한다. 모션 최소화 설정에서는 정지한다(BootScreen 선례). */}
          <Icon name="refresh" size={11} className="animate-spin motion-reduce:animate-none" />
        </span>
      )
    case 'aborted':
      return (
        <span className={`${BASE} bg-fill-uncontained-hover text-t6`}>
          <Icon name="stop" size={11} />
        </span>
      )
    case 'failed':
      return (
        <span
          className={`${BASE} bg-[color-mix(in_srgb,var(--color-bad)_16%,transparent)] text-bad`}
        >
          <Icon name="alert" size={11} />
        </span>
      )
    case 'pending':
      return (
        <span className={`${BASE} border border-t5 text-[10px] leading-none text-t6`}>{index}</span>
      )
  }
}
