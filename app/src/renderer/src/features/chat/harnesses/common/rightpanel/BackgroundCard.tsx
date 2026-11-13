import type { ReactNode } from 'react'
import { shouldActivateBackgroundCard } from '../../../lib/canonicalBackground'

// 백그라운드 타일 카드 틀(정본 작업·호출 카드와 구 모델 카드 공용). 안쪽에 중단·전환 버튼을 두려고 <button> 대신
// role="button" div 이고, 키 입력은 카드 자신이 받은 것만 연다 — 안쪽 버튼의 Enter·Space 는 그 버튼 몫이다.
// 접근성 이름은 호출부가 번역해 넘긴다(카드마다 번역 훅을 늘리지 않는다).
export function BackgroundCard({
  title,
  ariaLabel,
  onOpen,
  children,
  ...data
}: {
  title: string
  ariaLabel: string
  onOpen?: () => void
  children: ReactNode
  [data: `data-${string}`]: string
}): React.JSX.Element {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (shouldActivateBackgroundCard(event)) {
          event.preventDefault()
          onOpen?.()
        }
      }}
      aria-label={ariaLabel}
      className="group/subagent cursor-pointer rounded-r6 bg-bg2 px-3 py-2.5 text-left transition-colors hover:bg-fill-uncontained-hover focus:outline-none hide-focus-ring ring-focus"
      {...data}
    >
      <div className="flex min-w-0 items-center gap-g3">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-t6" />
        <span className="min-w-0 flex-1 truncate text-body font-semibold text-t9">{title}</span>
      </div>
      {children}
    </div>
  )
}
