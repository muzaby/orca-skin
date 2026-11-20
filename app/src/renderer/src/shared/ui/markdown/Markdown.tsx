import { MARKDOWN_TYPOGRAPHY } from './typography'
import { createContext, memo, useContext, type ReactNode } from 'react'
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'
import { isCodeBlock } from './isCodeBlock'
import { markSourceText, sourcePartSpans, type MarkdownSourcePart } from './sourceParts'
import { useI18n } from '../../i18n'

// 차단된 외부 이미지 플레이스홀더 — components 맵 항목은 react-markdown 이 컴포넌트로
// 렌더하므로 훅 사용이 가능하지만, 명시적 함수 컴포넌트로 분리해 의도를 드러낸다(0097).
function BlockedImagePlaceholder({ label }: { label: string }): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <span className="text-[calc(12px*var(--transcript-text-scale,1))] italic text-ink3">
      {tr('markdown.imagePlaceholder', { label })}
    </span>
  )
}

function Paragraph({ children }: { children?: ReactNode }): React.JSX.Element {
  return <p className="my-2 first:mt-0 last:mb-0">{children}</p>
}

function InlineCode({ children }: { children?: ReactNode }): React.JSX.Element {
  return (
    <code className="rounded border border-bubble-user bg-bubble-user px-1 py-[1px] font-mono text-[calc(12px*var(--transcript-text-scale,1))] text-ink">
      {children}
    </code>
  )
}

const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 text-[calc(18px*var(--transcript-text-scale,1))] font-semibold tracking-tight text-ink">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 text-[calc(16px*var(--transcript-text-scale,1))] font-semibold tracking-tight text-ink">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1.5 text-[calc(14.5px*var(--transcript-text-scale,1))] font-semibold text-ink">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 mb-1 text-[calc(13.5px*var(--transcript-text-scale,1))] font-semibold text-ink">
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h5 className="mt-2.5 mb-1 text-[calc(12.5px*var(--transcript-text-scale,1))] font-semibold text-ink">
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h6 className="mt-2.5 mb-1 text-[calc(12px*var(--transcript-text-scale,1))] font-medium uppercase tracking-wide text-ink2">
      {children}
    </h6>
  ),
  p: Paragraph,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-rust underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="my-2 list-disc pl-5 [&_ul]:my-1 [&_ol]:my-1">{children}</ul>,
  ol: ({ children }) => (
    <ol className="my-2 list-decimal pl-5 [&_ul]:my-1 [&_ol]:my-1">{children}</ol>
  ),
  li: ({ children, className }) => {
    // remark-gfm 은 태스크리스트 항목에 `task-list-item` 클래스를 붙인다 —
    // disc/decimal 마커를 지우고 체크박스가 텍스트 앞에 오게 정렬한다.
    const isTask = typeof className === 'string' && className.includes('task-list-item')
    return <li className={isTask ? 'my-0.5 list-none -ml-4' : 'my-0.5'}>{children}</li>
  },
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border-strong pl-3 text-ink2">
      {children}
    </blockquote>
  ),
  del: ({ children }) => <del className="text-ink3 line-through">{children}</del>,
  // GFM 태스크리스트 체크박스 — 읽기 전용(대화 표시용, 토글 없음). checked+disabled 로
  // React 의 uncontrolled 경고를 피한다.
  input: (props) => {
    const { type, checked } = props as { type?: string; checked?: boolean }
    if (type !== 'checkbox') return null
    return (
      <input
        type="checkbox"
        checked={!!checked}
        disabled
        readOnly
        className="mr-1.5 translate-y-[1px] align-middle accent-rust"
      />
    )
  },
  hr: () => <hr className="my-3 border-border" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[calc(12.5px*var(--transcript-text-scale,1))]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border-strong">{children}</thead>,
  // style 전달 — remark-gfm 이 컬럼 정렬(`:---:`)을 `text-align` 인라인 스타일로 넣는다.
  // 인라인 style 이 기본 `text-left` 클래스를 이긴다(미지정 컬럼은 좌측 유지).
  th: ({ children, style }) => (
    <th style={style} className="border-b border-border px-2 py-1 text-left font-semibold text-ink">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="border-b border-border px-2 py-1 text-ink">
      {children}
    </td>
  ),
  img: ({ src, alt }) => {
    // 외부 URL 차단 (TRD §1.3). data-uri 만 허용.
    const safe = typeof src === 'string' && src.startsWith('data:')
    if (!safe) {
      return <BlockedImagePlaceholder label={alt || (typeof src === 'string' ? src : '') || '?'} />
    }
    return <img src={src} alt={alt} className="my-2 max-w-full rounded" />
  },
  code: (props) => {
    const { children, className } = props as { children?: React.ReactNode; className?: string }
    const text = typeof children === 'string' ? children : ''
    if (!isCodeBlock(className, text)) {
      // 인라인 코드 — 테두리·배경을 사용자 메시지 버블 배경(`--color-bubble-user`)으로 통일.
      return <InlineCode>{children}</InlineCode>
    }
    const lang = (className ?? '').replace(/^language-/, '').trim() || undefined
    return <CodeBlock code={text.replace(/\n$/, '')} lang={lang} />
  },
  pre: ({ children }) => <>{children}</>
}

const MarkdownPartsContext = createContext<{
  source: string
  parts: readonly MarkdownSourcePart[]
} | null>(null)

const DefaultCode = COMPONENTS.code!

function SourcePartCode(props: React.ComponentProps<'code'> & ExtraProps): React.JSX.Element {
  const input = useContext(MarkdownPartsContext)
  const { children, className, node } = props
  const text = typeof children === 'string' ? children : ''
  const start = node?.position?.start.offset
  const end = node?.position?.end.offset
  if (!input || !isCodeBlock(className, text) || start === undefined || end === undefined) {
    return <DefaultCode {...props} />
  }
  const { source, parts } = input
  const firstLineEnd = source.indexOf('\n', start)
  const fenced = /^ {0,3}(?:`{3,}|~{3,})/.test(source.slice(start, firstLineEnd))
  const code = text.replace(/\n$/, '')
  const bodyStart = fenced && firstLineEnd >= start ? firstLineEnd + 1 : start
  const lineStart = source.lastIndexOf('\n', start - 1) + 1
  const opening = fenced
    ? /^( {0,3})(?:`{3,}|~{3,})/.exec(source.slice(lineStart, firstLineEnd))
    : null
  const lang = (className ?? '').replace(/^language-/, '').trim() || undefined
  return (
    <CodeBlock
      code={code}
      lang={lang}
      markedText={markSourceText(code, source, bodyStart, end, parts, {
        fenceIndent: opening?.[1].length ?? 0
      })}
    />
  )
}

const COMPONENTS_WITH_SOURCE_PARTS: Components = { ...COMPONENTS, code: SourcePartCode }

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
  const simple = simpleParagraph(source, sourceParts)
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
