import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
  type UIEvent
} from 'react'

// `/skillname` 패턴: 단어 경계 시작 + `/` + 소문자/숫자/하이픈/콜론(plugin:skill).
// `(?<=^|\s)` 로 단어 시작에서만 매치 (URL `https://` 등의 중간 `/` 는 제외).
const SKILL_TOKEN_RE = /(?<=^|\s)\/[a-z][a-z0-9:-]*\b/g

type TextSegment = { kind: 'text'; text: string } | { kind: 'chip'; text: string }

function tokenize(value: string): TextSegment[] {
  if (value === '') return []
  const segs: TextSegment[] = []
  let last = 0
  for (const m of value.matchAll(SKILL_TOKEN_RE)) {
    const start = m.index ?? 0
    if (start > last) segs.push({ kind: 'text', text: value.slice(last, start) })
    segs.push({ kind: 'chip', text: m[0] })
    last = start + m[0].length
  }
  if (last < value.length) segs.push({ kind: 'text', text: value.slice(last) })
  return segs
}

interface HighlightedTextareaProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  // caret 위치 변경 (selectionStart) 을 통보. 자동완성 picker 가 caret 직전 토큰을
  // 추적하기 위해 사용. textarea 의 `onSelect` + `onInput` + `onKeyUp` + `onMouseUp`
  // 합성 — selectionchange 는 document scope 라 비효율.
  onCaretChange?: (caret: number) => void
  placeholder?: string
  rows?: number
  className?: string
  textareaClassName?: string
  ariaLabel?: string
}

export interface HighlightedTextareaHandle {
  focus(): void
  setSelectionRange(start: number, end: number): void
  readonly element: HTMLTextAreaElement | null
}

// textarea + mirror overlay — textarea 는 caret 만 보이고 텍스트는 mirror <div> 가
// 그린다 (`/skillname` 부분만 파란 chip 으로 강조). mirror 와 textarea 는 동일한
// font / padding / line-height / word-break 를 공유해야 caret 위치가 일치한다.
export const HighlightedTextarea = forwardRef<HighlightedTextareaHandle, HighlightedTextareaProps>(
  function HighlightedTextarea(
    {
      value,
      onChange,
      onKeyDown,
      onCaretChange,
      placeholder,
      rows = 1,
      className = '',
      textareaClassName = '',
      ariaLabel
    },
    ref
  ): React.JSX.Element {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const mirrorRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(
      ref,
      (): HighlightedTextareaHandle => ({
        focus: () => textareaRef.current?.focus(),
        setSelectionRange: (s, e) => textareaRef.current?.setSelectionRange(s, e),
        get element(): HTMLTextAreaElement | null {
          return textareaRef.current
        }
      }),
      []
    )

    const handleScroll = (e: UIEvent<HTMLTextAreaElement>): void => {
      const m = mirrorRef.current
      if (m) m.scrollTop = e.currentTarget.scrollTop
    }

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
      onChange(e.target.value)
      onCaretChange?.(e.target.selectionStart)
    }

    const handleCaret = (e: { currentTarget: HTMLTextAreaElement }): void => {
      onCaretChange?.(e.currentTarget.selectionStart)
    }

    const segments = tokenize(value)
    // textarea 의 trailing newline 은 추가 빈 줄을 만들기 위해 mirror 끝에 ZWSP 추가.
    const trailingPad = value.endsWith('\n') ? '​' : ''

    // 두 노드가 정확히 같은 typography/padding/border 를 갖도록 공유 클래스.
    // textarea 와 mirror 모두에 적용된다.
    const sharedTypo =
      'block w-full px-1 py-1.5 text-[13px] leading-[1.6] font-sans whitespace-pre-wrap break-words'

    return (
      <div className={`relative ${className}`}>
        <div
          ref={mirrorRef}
          aria-hidden
          className={`${sharedTypo} pointer-events-none max-h-40 min-h-9 overflow-hidden text-ink`}
        >
          {value === '' && placeholder ? (
            <span className="text-ink3">{placeholder}</span>
          ) : (
            <>
              {segments.map((s, i) =>
                s.kind === 'chip' ? (
                  <span key={i} className="rounded bg-blue-500/15 px-1 font-mono text-blue-500">
                    {s.text}
                  </span>
                ) : (
                  <span key={i}>{s.text}</span>
                )
              )}
              {trailingPad}
            </>
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          onKeyUp={handleCaret}
          onMouseUp={handleCaret}
          onSelect={handleCaret}
          onScroll={handleScroll}
          placeholder={placeholder}
          rows={rows}
          aria-label={ariaLabel}
          className={`${sharedTypo} absolute inset-0 max-h-40 min-h-9 resize-none border-0 bg-transparent text-transparent caret-ink outline-none placeholder:text-transparent ${textareaClassName}`}
        />
      </div>
    )
  }
)
