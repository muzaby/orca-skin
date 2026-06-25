import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Popover } from '../../../../shared/ui/Popover'
import { Button } from '../../../../shared/ui/Button'
import { quoteSnippet } from '../../lib/planComments'

export interface PopoverAnchorRect {
  top: number
  left: number
  bottom: number
  right: number
}

interface PlanCommentPopoverProps {
  anchorRect: PopoverAnchorRect
  quote: string
  mode: 'create' | 'edit'
  initialBody?: string
  onSave: (body: string) => void
  onDelete?: () => void
  onClose: () => void
}

// 코멘트 작성/편집 팝오버. 선택 영역 좌표에 둔 0-size 가상 앵커로 공용 Popover(외부클릭·ESC·
// flip)를 재사용한다. 작성=저장만, 편집=저장+삭제.
export function PlanCommentPopover({
  anchorRect,
  quote,
  mode,
  initialBody = '',
  onSave,
  onDelete,
  onClose
}: PlanCommentPopoverProps): React.JSX.Element {
  const anchorRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // initialBody 는 마운트 시 1회 시드 — 다른 코멘트로 전환 시 호출부가 key 로 remount 한다
  // (prop→state 재동기화 effect 회피).
  const [body, setBody] = useState(initialBody)

  useEffect(() => {
    const id = requestAnimationFrame(() => textareaRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  const canSave = body.trim() !== ''
  const submit = (): void => {
    if (canSave) onSave(body.trim())
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <>
      <div
        ref={anchorRef}
        aria-hidden
        className="fixed h-0 w-0"
        style={{ top: anchorRect.bottom, left: anchorRect.left }}
      />
      <Popover
        open
        anchorRef={anchorRef}
        onClose={onClose}
        placement="top"
        className="w-[280px] p-2"
      >
        <div className="flex flex-col gap-2">
          <div className="line-clamp-2 rounded-r4 border-l-2 border-rust/60 bg-bg px-2 py-1 text-caption text-t6">
            {quoteSnippet(quote, 80)}
          </div>
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            placeholder="댓글"
            aria-label="코멘트 내용"
            className="w-full resize-y rounded-r4 border border-t5 bg-bg px-2 py-1.5 text-footnote text-t9 outline-none ring-focus placeholder:text-t6 focus:border-border-strong"
          />
          <div className="flex items-center justify-between gap-g3">
            {mode === 'edit' && onDelete ? (
              <Button size="small" variant="uncontained" leadingIcon="trash" onClick={onDelete}>
                삭제
              </Button>
            ) : (
              <span />
            )}
            <Button
              size="small"
              variant="primary"
              onClick={submit}
              disabled={!canSave}
              kbd="Ctrl+Enter"
            >
              저장
            </Button>
          </div>
        </div>
      </Popover>
    </>
  )
}
