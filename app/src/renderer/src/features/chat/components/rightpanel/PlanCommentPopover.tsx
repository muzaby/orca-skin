import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { quoteSnippet } from '../../lib/planComments'

export interface PopoverAnchorPoint {
  x: number
  top: number
  bottom: number
  containerWidth: number
}

interface PlanCommentPopoverProps {
  anchor: PopoverAnchorPoint
  quote: string
  mode: 'create' | 'edit'
  initialBody?: string
  onSave: (body: string) => void
  onDelete?: () => void
  onClose: () => void
}

const GAP = 8
const EDGE_MARGIN = 8
const PANEL_WIDTH = 560

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

// 계획 본문(contentRef) 내부 absolute 팝오버. 하이라이트와 같은 상대좌표계를 사용해 right panel/
// viewport 좌표계와 분리한다. 기본은 선택 영역 bottom 아래, 뷰포트를 넘으면 선택 영역 위로 flip.
export function PlanCommentPopover({
  anchor,
  quote,
  mode,
  initialBody = '',
  onSave,
  onDelete,
  onClose
}: PlanCommentPopoverProps): React.JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [body, setBody] = useState(initialBody)
  const [placeAbove, setPlaceAbove] = useState(false)

  const canSave = body.trim() !== ''

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [body])

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    setPlaceAbove(rect.bottom > window.innerHeight - EDGE_MARGIN)
  }, [anchor, body])

  useEffect(() => {
    const focusId = requestAnimationFrame(() => textareaRef.current?.focus())
    const onDocMouseDown = (e: MouseEvent): void => {
      const target = e.target as Node | null
      if (panelRef.current?.contains(target ?? null)) return
      onClose()
    }
    const onDocKeyDown = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onDocKeyDown)
    return () => {
      cancelAnimationFrame(focusId)
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onDocKeyDown)
    }
  }, [onClose])

  const submit = (): void => {
    if (canSave) onSave(body.trim())
  }

  const onTextareaKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const panelW = Math.min(PANEL_WIDTH, Math.max(0, anchor.containerWidth - EDGE_MARGIN * 2))
  const left = clamp(
    anchor.x - panelW / 2,
    EDGE_MARGIN,
    Math.max(EDGE_MARGIN, anchor.containerWidth - panelW - EDGE_MARGIN)
  )
  const style: CSSProperties = placeAbove
    ? { left, top: anchor.top - GAP, width: panelW, transform: 'translateY(-100%)' }
    : { left, top: anchor.bottom + GAP, width: panelW }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${mode === 'create' ? '코멘트 작성' : '코멘트 편집'}: ${quoteSnippet(quote, 120)}`}
      className="absolute z-50 overflow-hidden rounded-r6 border border-border bg-white shadow-[0_8px_24px_rgba(0,0,0,.16)]"
      style={style}
      data-context="floating"
      data-behavior="dismissible"
    >
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onTextareaKeyDown}
        rows={1}
        placeholder="코멘트 추가…"
        aria-label="코멘트 내용"
        className="block max-h-48 min-h-12 w-full resize-none overflow-hidden border-0 bg-white px-3 py-2.5 text-footnote text-t9 outline-none ring-0 placeholder:text-t6 focus:ring-0"
      />
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        {mode === 'edit' && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex cursor-default items-center gap-1 rounded-r4 border-0 bg-transparent px-1 py-0.5 text-footnote text-t7 outline-none hover:text-t9"
          >
            <Icon name="trash" size={15} />
            삭제
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!canSave}
          className="inline-flex cursor-default items-center gap-1 rounded-r5 border-0 bg-ink px-3 py-1.5 text-footnote font-medium text-bg outline-none disabled:opacity-40"
        >
          댓글
          <span className="text-caption opacity-70">↩</span>
        </button>
      </div>
    </div>
  )
}
