import { Icon } from '../../../../shared/ui/Icon'
import type { TaskBoardStatus } from '../../lib/taskBoard'

// 상태 원형 아이콘 — cowork 우측 패널 양식(원형 배지 + ✓/↻/번호)을 시맨틱 토큰으로 옮긴 것이다.
// raw hex 를 쓰지 않으므로 두 테마에서 함께 따라온다(renderer/AGENTS §스타일).
//
// props 가 **판별 union** 인 이유(0204 §10): 번호 배지는 `pending` 에만 존재한다. 그 상태는
// agent Task 만 가질 수 있고(background 는 진행/종단만 있다) 배지에 들어가는 값은 그 Task 의
// id 다. flat `{ status, badge }` 로 두면 background 의 tool_use id(불투명 긴 문자열)를 18px
// 원에 넣는 조합을 타입이 허용한다 — 여기서는 그 조합이 컴파일되지 않는다.
export type TaskStatusIconProps =
  { status: 'pending'; badge: string } | { status: Exclude<TaskBoardStatus, 'pending'> }

const BASE = 'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full mt-px'

export function TaskStatusIcon(props: TaskStatusIconProps): React.JSX.Element {
  switch (props.status) {
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
            props.status === 'stopping'
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
        <span className={`${BASE} border border-t5 text-[10px] leading-none text-t6`}>
          {props.badge}
        </span>
      )
  }
}
