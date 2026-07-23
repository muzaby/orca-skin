import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ChangeEvent,
  type CompositionEvent,
  type KeyboardEvent,
  type UIEvent
} from 'react'
import { ComposerDecorationLayer } from './ComposerDecorationLayer'
import type { DraftSnapshot } from './draftSnapshot'

interface ComposerInputSurfaceProps {
  snapshot: DraftSnapshot
  onTextChange: (text: string, selectionStart: number, selectionEnd: number) => void
  onSelectionChange: (selectionStart: number, selectionEnd: number) => void
  onCompositionChange: (
    composing: boolean,
    text: string,
    selectionStart: number,
    selectionEnd: number
  ) => void
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  knownSkillNames: ReadonlySet<string>
  validFilePaths: ReadonlySet<string>
  placeholder?: string
  ariaLabel?: string
}

export interface ComposerInputSurfaceHandle {
  focus(): void
  setSelectionRange(start: number, end: number): void
  readonly element: HTMLTextAreaElement | null
}

const TYPOGRAPHY =
  'block w-full px-1 py-1.5 text-[13px] leading-[1.6] font-sans whitespace-pre-wrap break-words'

export const ComposerInputSurface = forwardRef<
  ComposerInputSurfaceHandle,
  ComposerInputSurfaceProps
>(function ComposerInputSurface(
  {
    snapshot,
    onTextChange,
    onSelectionChange,
    onCompositionChange,
    onKeyDown,
    knownSkillNames,
    validFilePaths,
    placeholder,
    ariaLabel
  },
  ref
): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const decorationRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(
    ref,
    () => ({
      focus: () => textareaRef.current?.focus(),
      setSelectionRange: (start, end) => textareaRef.current?.setSelectionRange(start, end),
      get element(): HTMLTextAreaElement | null {
        return textareaRef.current
      }
    }),
    []
  )

  const selection = (target: HTMLTextAreaElement): void => {
    onSelectionChange(target.selectionStart, target.selectionEnd)
  }
  const change = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    const target = event.currentTarget
    onTextChange(target.value, target.selectionStart, target.selectionEnd)
  }
  const composition = (event: CompositionEvent<HTMLTextAreaElement>, composing: boolean): void => {
    const target = event.currentTarget
    onCompositionChange(composing, target.value, target.selectionStart, target.selectionEnd)
  }
  const scroll = (event: UIEvent<HTMLTextAreaElement>): void => {
    if (!decorationRef.current) return
    decorationRef.current.scrollTop = event.currentTarget.scrollTop
    decorationRef.current.scrollLeft = event.currentTarget.scrollLeft
  }

  return (
    <div className="relative">
      <ComposerDecorationLayer
        ref={decorationRef}
        snapshot={snapshot}
        knownSkillNames={knownSkillNames}
        validFilePaths={validFilePaths}
        typographyClassName={TYPOGRAPHY}
      />
      <textarea
        ref={textareaRef}
        value={snapshot.text}
        onChange={change}
        onKeyDown={onKeyDown}
        onKeyUp={(event) => selection(event.currentTarget)}
        onMouseUp={(event) => selection(event.currentTarget)}
        onSelect={(event) => selection(event.currentTarget)}
        onScroll={scroll}
        onCompositionStart={(event) => composition(event, true)}
        onCompositionEnd={(event) => composition(event, false)}
        placeholder={placeholder}
        rows={1}
        aria-label={ariaLabel}
        className={`${TYPOGRAPHY} relative max-h-56 min-h-9 resize-none overflow-y-auto border-0 bg-transparent text-ink caret-ink outline-none placeholder:text-ink3 [field-sizing:content]`}
      />
    </div>
  )
})
