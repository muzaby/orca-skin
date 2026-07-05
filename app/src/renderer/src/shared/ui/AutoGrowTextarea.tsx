import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'

interface AutoGrowTextareaProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
}

// Composer 입력과 같은 오토그로우 textarea — 내용에 따라 높이가 늘다가 max-height(className
// 으로 지정)에 닿으면 스크롤로 이어진다. 사용자 리사이즈 핸들(resize)은 노출하지 않는다
// (resize-none). 높이는 매 value 변경마다 scrollHeight 로 재계산(height:auto 로 초기화 후 측정),
// CSS max-height 가 상한을 잡고 overflow-y-auto 가 초과분을 스크롤한다.
export function AutoGrowTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  ariaLabel,
  className = ''
}: AutoGrowTextareaProps): React.JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      rows={1}
      className={`block w-full resize-none overflow-y-auto rounded-r4 border border-border bg-bg px-3 py-2 text-[13px] leading-[1.6] text-ink outline-none placeholder:text-ink3 focus:border-border-strong ${className}`}
    />
  )
}
