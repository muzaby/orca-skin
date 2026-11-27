import { MARKDOWN_TYPOGRAPHY } from './typography'
import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'
import { markSourceText, sourcePartSpans, type MarkdownSourcePart } from './sourceParts'
import {
  Paragraph,
  InlineCode,
  MarkdownPartsContext,
  COMPONENTS,
  COMPONENTS_WITH_SOURCE_PARTS
} from './markdownComponents'

// A single unformatted line or simple code spans can bypass unified entirely. Keep the
// accepted alphabet narrow: whitespace normalization, block syntax, entities, escapes,
// HTML, links and GFM autolinks all belong to the full parser.
function simpleParagraph(
  source: string,
  parts?: readonly MarkdownSourcePart[]
): React.JSX.Element | null {
  if (!source || source.trim() !== source || /[\r\n]/.test(source)) return null
  if (!/^[\p{L}\p{N}`]/u.test(source) || /^\d{1,9}[.)](?: |$)/.test(source)) return null
  if (source.includes('``')) return null
  const tokens = source.split('`')
  if (tokens.length % 2 !== 1) return null
  for (const [index, token] of tokens.entries()) {
    if (index % 2 === 1) {
      if (!/^[a-zA-Z0-9_./-]+$/.test(token)) return null
    } else if (!/^[\p{L}\p{M}\p{N} ,.:;!?%()'+#-]*$/u.test(token) || /www\./i.test(token)) {
      return null
    }
  }
  let start = 0
  const children = tokens.map((token, index) => {
    const end = start + token.length
    const marked =
      parts?.length && token
        ? markSourceText(token, source, start, end, parts).map((run, part) => (
            <span key={part} data-part-key={run.key} data-markdown-part-fragment="">
              {run.text}
            </span>
          ))
        : token
    start = end + 1
    return index % 2 === 1 ? <InlineCode key={index}>{marked}</InlineCode> : marked
  })
  return <Paragraph>{children}</Paragraph>
}

// A plain lead-in followed by one language-tagged fence is common in tool transcripts.
// Keep source-part mapping, normalized characters and ambiguous fences on the full parser.
function paragraphAndFence(source: string): React.JSX.Element | null {
  const opening = source.indexOf('\n```')
  if (opening < 1 || !source.endsWith('\n```')) return null
  const lead = simpleParagraph(source.slice(0, opening))
  if (!lead) return null
  const bodyStart = source.indexOf('\n', opening + 4)
  const language = source.slice(opening + 4, bodyStart)
  if (bodyStart < 0 || !/^[a-zA-Z0-9_-]+$/.test(language)) return null
  const code = source.slice(bodyStart + 1, -4)
  if (!code || code.includes('\r') || code.includes('\0') || /^(?: {0,3}`{3,})/m.test(code))
    return null
  return (
    <>
      {lead}
      {'\n'}
      <CodeBlock code={code} lang={language} />
    </>
  )
}

export interface MarkdownProps {
  source: string
  sourceParts?: readonly MarkdownSourcePart[]
  // 본문 래퍼 클래스 override — 미지정 시 채팅 본문 톤(text-ink/leading-1.65).
  // skills 상세 패널 등 다른 톤이 필요한 호출부가 색·행간을 덮어쓴다.
  className?: string
}

const DEFAULT_WRAPPER = `${MARKDOWN_TYPOGRAPHY} text-ink`

// memo: source 는 string(값 비교)이라 기본 shallow 비교로 동일 본문의 unified 재파싱을
// 건너뛴다 — 부모(messageSegments)가 세그먼트 객체를 재생성해도 안전 (0007-transcript-render-memo).
export const Markdown = memo(function Markdown({
  source,
  className,
  sourceParts
}: MarkdownProps): React.JSX.Element {
  const simple =
    simpleParagraph(source, sourceParts) ??
    (!sourceParts?.length ? paragraphAndFence(source) : null)
  return (
    <div className={className ?? DEFAULT_WRAPPER}>
      {simple ?? (
        <MarkdownPartsContext.Provider
          value={sourceParts?.length ? { source, parts: sourceParts } : null}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={sourceParts?.length ? [sourcePartSpans(source, sourceParts)] : undefined}
            components={sourceParts?.length ? COMPONENTS_WITH_SOURCE_PARTS : COMPONENTS}
          >
            {source}
          </ReactMarkdown>
        </MarkdownPartsContext.Provider>
      )}
    </div>
  )
})
