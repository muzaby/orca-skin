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

// `@<path>` 또는 `@"<path with space>"` 두 형태. quoted 는 닫는 따옴표까지 매치
// (미닫힘은 chip 화하지 않음). 캡처 그룹 1 = quoted content, 2 = plain content.
// `[^\s"]+` 로 plain 에서 `"` 를 제외해 quoted 와 충돌하지 않게 한다.
const FILE_TOKEN_RE = /(?<=^|\s)@(?:"([^"\n]*)"|([^\s"]+))/g

const EMPTY_SET: ReadonlySet<string> = new Set()

type ChipKind = 'skill' | 'file'
type TextSegment = { kind: 'text'; text: string } | { kind: 'chip'; chip: ChipKind; text: string }

function tokenize(
  value: string,
  knownSkillNames: ReadonlySet<string>,
  validFilePaths: ReadonlySet<string>
): TextSegment[] {
  if (value === '') return []
  // 두 정규식 매칭을 합쳐 시작 위치 순으로 정렬 — overlap 은 정규식 디자인상 발생 X.
  interface Hit {
    start: number
    end: number
    text: string
    chip: ChipKind
  }
  const hits: Hit[] = []
  for (const m of value.matchAll(SKILL_TOKEN_RE)) {
    if (!knownSkillNames.has(m[0].slice(1))) continue
    const start = m.index ?? 0
    hits.push({ start, end: start + m[0].length, text: m[0], chip: 'skill' })
  }
  for (const m of value.matchAll(FILE_TOKEN_RE)) {
    // quoted (그룹1) 우선, 없으면 plain (그룹2). validPaths 는 raw path 저장.
    // 디렉토리는 set 에 `path/` 형태로, 파일은 `path` 형태로 저장돼 있다.
    const raw = m[1] ?? m[2]
    if (!validFilePaths.has(raw)) continue
    const start = m.index ?? 0
    hits.push({ start, end: start + m[0].length, text: m[0], chip: 'file' })
  }
  hits.sort((a, b) => a.start - b.start)

  const segs: TextSegment[] = []
  let last = 0
  for (const h of hits) {
    if (h.start < last) continue // 겹침 방어 (이론상 없음)
    if (h.start > last) segs.push({ kind: 'text', text: value.slice(last, h.start) })
    segs.push({ kind: 'chip', chip: h.chip, text: h.text })
    last = h.end
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
  // chip 으로 강조할 활성 스킬 이름 집합 (`/<name>` 의 `<name>` 부분). 매치되지
  // 않은 토큰은 일반 텍스트로 렌더 — 존재하지 않는 스킬을 chip 으로 오인하지 않게.
  knownSkillNames?: ReadonlySet<string>
  // chip 으로 강조할 유효 파일 경로 집합 (`@<path>` 의 `<path>` 부분). 파일은 그대로,
  // 디렉토리는 `path/` 형태로 저장. 검증되지 않은 토큰은 평문.
  validFilePaths?: ReadonlySet<string>
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
      knownSkillNames,
      validFilePaths,
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

    const segments = tokenize(value, knownSkillNames ?? EMPTY_SET, validFilePaths ?? EMPTY_SET)
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
          className={`${sharedTypo} pointer-events-none max-h-56 min-h-9 overflow-hidden text-ink`}
        >
          {value === '' && placeholder ? (
            <span className="text-ink3">{placeholder}</span>
          ) : (
            <>
              {segments.map((s, i) =>
                s.kind === 'chip' ? (
                  <span
                    key={i}
                    className={
                      s.chip === 'skill'
                        ? 'rounded bg-blue-500/15 text-blue-500'
                        : 'rounded bg-emerald-500/15 text-emerald-600'
                    }
                  >
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
          className={`${sharedTypo} absolute inset-0 max-h-56 min-h-9 resize-none border-0 bg-transparent text-transparent caret-ink outline-none placeholder:text-transparent ${textareaClassName}`}
        />
      </div>
    )
  }
)
