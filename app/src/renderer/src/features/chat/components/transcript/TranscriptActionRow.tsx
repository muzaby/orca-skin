import type { ReactNode } from 'react'
import { Icon } from '../../../../shared/ui/Icon'

// 트랜스크립트의 "클릭하면 우측 패널이 열리는 한 줄 행" 표준 셸(0149). AgentTaskRow(서브에이전트
// 진행/완료)와 SubagentNoticeRow(백그라운드 완료 통지)가 같은 크롬·키보드 계약·포커스 링을
// 각자 복제하고 있었다 — 한쪽만 고치면 두 행의 접근성이 갈라진다.
//
// Tailwind JIT 주의: `group-hover/<name>:` variant 는 그 리터럴이 **소스에 있어야** 생성된다.
// 그래서 group 클래스를 prop 으로 받고(호출부 소스에 리터럴로 남음), 자식들도 자기 호출부에서
// 같은 이름의 group-hover 리터럴을 쓴다(app/AGENTS.md §스타일링 그룹 스코프 격리).
export function TranscriptActionRow({
  groupClassName,
  onActivate,
  children
}: {
  groupClassName: string
  onActivate: () => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
      className={`${groupClassName} flex max-w-full cursor-pointer items-center gap-g2 self-start text-left text-body text-t6 outline-none hide-focus-ring ring-focus`}
    >
      {children}
      <span aria-hidden className="shrink-0">
        <Icon name="chevR" size={12} />
      </span>
    </div>
  )
}
