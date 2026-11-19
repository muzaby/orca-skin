import { useTranscriptReveal } from '../../../components/transcript/TranscriptViewport'
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode
} from 'react'
import { TRANSCRIPT_TEXT_SCALE } from '../../../../../shared/config/theme'
import { useI18n } from '../../../../../shared/i18n'
import { useOptionalTweak } from '../../../../../shared/theme/TweakProvider'
import { USER_BUBBLE_COLLAPSED_CLASS, bubbleView } from '../../../lib/bubbleCollapse'
import { useBubbleOverflow } from '../../../lib/bubbleMeasure'
import { toggleBubbleExpanded, useBubbleExpanded } from '../../../store/bubbleExpansionStore'

const USER_BUBBLE_TEXT_CLASS = 'min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]'

interface UserBubbleTextProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** 버블 표면(배경·여백·반경·폭·글자). */
  className?: string
  /** 본문 배치(예: 여러 줄 묶음의 flex 열). */
  contentClassName?: string
  /** 펼침 상태를 재마운트 너머로 보존할 키(0257 D-011). 없으면 컴포넌트 수명 동안만 기억한다. */
  collapseKey?: string
}

// 사용자 발화 버블 본문 공통 정책.
// - pre-wrap: 사용자가 입력한 줄바꿈/공백을 보존한다.
// - overflow-wrap:anywhere + break-words: 긴 단일 토큰/URL도 버블 폭 안에서 줄바꿈한다.
// - 0257 D-008: 본문이 10줄을 넘으면 접고(마지막 줄 흐림) 버블 안에 '더 보기'/'간략히 보기'를 둔다.
export function UserBubbleText({
  children,
  className = '',
  contentClassName = '',
  collapseKey,
  ...props
}: UserBubbleTextProps): React.JSX.Element {
  const { tr } = useI18n()
  const reveal = useTranscriptReveal()
  const { transcriptTextSize, appFont } = useOptionalTweak((t) => ({
    transcriptTextSize: t.transcriptTextSize,
    appFont: t.appFont
  }))
  const contentId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [localExpanded, setLocalExpanded] = useState(false)
  const storedExpanded = useBubbleExpanded(collapseKey)
  const expanded = collapseKey ? storedExpanded : localExpanded
  const scrollAfterCollapse = useRef(false)

  const scale = TRANSCRIPT_TEXT_SCALE[transcriptTextSize]
  const bubbleVariant = `${className}\0${contentClassName}\0${appFont}`
  const overflowing = useBubbleOverflow(contentRef, {
    content: children,
    scale,
    bubbleVariant
  })

  useLayoutEffect(() => {
    if (expanded || !scrollAfterCollapse.current) return
    scrollAfterCollapse.current = false
    const root = rootRef.current
    if (!root) return
    reveal(root)
  }, [expanded, reveal])

  const view = bubbleView({ overflowing, expanded })
  const toggle = (): void => {
    if (expanded) scrollAfterCollapse.current = true
    if (collapseKey) toggleBubbleExpanded(collapseKey)
    else setLocalExpanded((value) => !value)
  }

  return (
    <div ref={rootRef} className={`min-w-0 ${className}`} {...props}>
      <div
        id={contentId}
        ref={contentRef}
        className={`${USER_BUBBLE_TEXT_CLASS} ${contentClassName} ${view.collapsed ? USER_BUBBLE_COLLAPSED_CLASS : ''}`}
      >
        {children}
      </div>
      {view.toggleLabelKey && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          data-behavior="bubble:toggle"
          onClick={toggle}
          className="mt-1.5 rounded-r3 border-0 bg-transparent px-1.5 py-0.5 text-footnote not-italic text-ink transition-colors hover:bg-fill-uncontained-hover hide-focus-ring ring-focus"
        >
          {tr(view.toggleLabelKey)}
        </button>
      )}
    </div>
  )
}
