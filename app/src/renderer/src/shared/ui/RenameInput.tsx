import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

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
}

export function RenameInput({
  initial,
  onCommit,
  onCancel,
  className,
  ariaLabel = '제목 편집',
  maxLength = 120
}: RenameInputProps): React.JSX.Element {
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
      className={
        className ??
        'w-full rounded border border-border-strong bg-panel px-1.5 py-0.5 text-[12px] text-ink outline-none'
      }
      aria-label={ariaLabel}
    />
  )
}
