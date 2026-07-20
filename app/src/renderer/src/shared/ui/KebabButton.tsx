import { forwardRef, type MouseEvent } from 'react'
import { Icon } from './Icon'
import { useI18n } from '../i18n'

// 행 hover 시 나타나는 케밥(⋮) 메뉴 트리거 — 사이드바 SessionRow·PinnedSection 등
// 목록 행이 공유한다. 기본은 숨김이고 부모 `group/<name>` hover 또는 open(메뉴 열림)에서
// 노출된다. Tailwind JIT 가 group-hover variant 를 생성하려면 리터럴이 소스에 있어야 하므로
// revealClass 는 호출부가 `group-hover/<name>:grid` 문자열을 그대로 넘긴다.
export interface KebabButtonProps {
  open: boolean
  onToggle: (e: MouseEvent<HTMLButtonElement>) => void
  // 부모 group hover 시 노출 클래스(예: 'group-hover/session:grid'). 부모가 group/<name> 선언.
  revealClass: string
  // 메뉴 접근성 라벨(행 유형별로 다름). title 은 항상 common.more.
  ariaLabel: string
}

export const KebabButton = forwardRef<HTMLButtonElement, KebabButtonProps>(function KebabButton(
  { open, onToggle, revealClass, ariaLabel },
  ref
) {
  const { tr } = useI18n()
  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      className={`h-5 w-5 cursor-pointer place-items-center rounded border-0 bg-transparent text-ink3 hover:text-ink ${
        open ? 'grid' : `hidden ${revealClass}`
      }`}
      title={tr('common.more')}
      aria-label={ariaLabel}
      aria-haspopup="menu"
      aria-expanded={open}
    >
      <Icon name="kebab" size={14} />
    </button>
  )
})
