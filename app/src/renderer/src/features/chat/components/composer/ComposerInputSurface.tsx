import { composerAppearance } from '../../harnesses/presentation'
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
import { composerDecorationTransform } from './composerScrollProjection'
import type { DraftSnapshot } from './draftSnapshot'

interface ComposerInputSurfaceProps {
  openCode?: boolean
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
  validPluginIds?: ReadonlySet<string>
  placeholder?: string
  ariaLabel?: string
}

export interface ComposerInputSurfaceHandle {
  focus(): void
  setSelectionRange(start: number, end: number): void
}

const EMPTY_PLUGIN_IDS = new Set<string>()

export const ComposerInputSurface = forwardRef<
  ComposerInputSurfaceHandle,
  ComposerInputSurfaceProps
>(function ComposerInputSurface(
  {
    openCode = false,
    snapshot,
    onTextChange,
    onSelectionChange,
    onCompositionChange,
    onKeyDown,
    knownSkillNames,
    validFilePaths,
    validPluginIds,
    placeholder,
    ariaLabel
  },
  ref
): React.JSX.Element {
  const appearance = composerAppearance(openCode)
  const typography = appearance.typography
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const decorationProjectionRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(
    ref,
    () => ({
      focus: () => textareaRef.current?.focus(),
      setSelectionRange: (start, end) => textareaRef.current?.setSelectionRange(start, end)
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
    const projection = decorationProjectionRef.current
    if (!projection) return

    // textarea만 scroll authority를 가진다. decoration은 독립 scrollTop을 복사하지 않고
    // native viewport 좌표를 그대로 투영하므로 deferred content가 짧아도 offset이 clamp되지 않는다.
    projection.style.transform = composerDecorationTransform(
      event.currentTarget.scrollLeft,
      event.currentTarget.scrollTop
    )
  }

  return (
    <div className="relative">
      <ComposerDecorationLayer
        ref={decorationProjectionRef}
        snapshot={snapshot}
        knownSkillNames={knownSkillNames}
        validFilePaths={validFilePaths}
        validPluginIds={validPluginIds ?? EMPTY_PLUGIN_IDS}
        typographyClassName={typography}
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
        className={`${typography} relative ${appearance.textarea} resize-none overflow-y-auto border-0 bg-transparent outline-none [field-sizing:content]`}
      />
    </div>
  )
})
