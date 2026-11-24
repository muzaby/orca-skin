import type { KeyboardEvent } from 'react'

interface AutoGrowTextareaProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
}

// CSS sizes the input for its current content and width. The caller owns the height limit.
export function AutoGrowTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  ariaLabel,
  className = ''
}: AutoGrowTextareaProps): React.JSX.Element {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      rows={1}
      className={`block w-full [field-sizing:content] resize-none overflow-y-auto rounded-r4 border border-border bg-bg px-3 py-2 text-[13px] leading-[1.6] text-ink outline-none placeholder:text-ink3 focus:border-border-strong ${className}`}
    />
  )
}
