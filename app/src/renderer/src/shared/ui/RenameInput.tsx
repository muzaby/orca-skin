import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useI18n } from '../i18n'

// 인플레이스 rename input — Enter 저장 / Esc 취소 / blur 저장. 마운트 시 autofocus +
// 전체 선택. IME 조합 중 Enter 는 확정 키이므로 커밋하지 않는다(`isComposing` 가드).
// SessionRow(사이드바)·ChatTitleBar(트랜스크립트 헤더) 양쪽에서 공유 — className 으로
// 각 문맥의 타이포/여백을 주입한다.
export interface RenameInputProps {
  initial: string
  onCommit: (value: string) => void
  onCancel: () => void
  className?: string
  ariaLabel?: string
  maxLength?: number
  // Claude Desktop 처럼 편집 영역이 텍스트 길이만큼 가변한다. CSS `field-sizing: content`
  // (Electron 39 Chromium 지원) 로 콘텐츠 폭에 맞춰 input 을 크기 조정한다 — JS 측정 불필요.
  // min/max 폭으로 빈 값 0폭 붕괴·컨테이너 초과를 막는다. 호출자는 `flex-1` 을 주지 않는다.
  autoSize?: boolean
}

// autoSize 기본 스타일 — `[field-sizing:content]` 로 콘텐츠 폭 추종, `size={1}`+min-w 로
// 빈 값에서도 최소폭 확보, max-w-full 로 컨테이너 초과 방지.
const AUTO_SIZE_CLASS =
  'w-auto min-w-[3ch] max-w-full [field-sizing:content] rounded border border-border-strong bg-panel px-1.5 py-0.5 text-[12px] text-ink outline-none'

export function RenameInput({
  initial,
  onCommit,
  onCancel,
  className,
  ariaLabel,
  maxLength = 120,
  autoSize = false
}: RenameInputProps): React.JSX.Element {
  const { tr } = useI18n()
  const [value, setValue] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      onCommit(value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => onCommit(value)}
      onClick={(e) => e.stopPropagation()}
      maxLength={maxLength}
      {...(autoSize ? { size: 1 } : {})}
      className={
        className ??
        (autoSize
          ? AUTO_SIZE_CLASS
          : 'w-full rounded border border-border-strong bg-panel px-1.5 py-0.5 text-[12px] text-ink outline-none')
      }
      aria-label={ariaLabel ?? tr('common.editTitle')}
    />
  )
}
