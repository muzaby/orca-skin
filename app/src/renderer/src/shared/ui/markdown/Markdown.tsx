import { memo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'
import { useI18n } from '../../i18n'

// 차단된 외부 이미지 플레이스홀더 — components 맵 항목은 react-markdown 이 컴포넌트로
// 렌더하므로 훅 사용이 가능하지만, 명시적 함수 컴포넌트로 분리해 의도를 드러낸다(0097).
function BlockedImagePlaceholder({ label }: { label: string }): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <span className="text-[12px] italic text-ink3">
      {tr('markdown.imagePlaceholder', { label })}
    </span>
  )
}

const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 text-[18px] font-semibold tracking-tight text-ink">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 text-[16px] font-semibold tracking-tight text-ink">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1.5 text-[14.5px] font-semibold text-ink">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 mb-1 text-[13.5px] font-semibold text-ink">{children}</h4>
  ),
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
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
  li: ({ children }) => <li className="my-0.5">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border-strong pl-3 text-ink2">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border-strong">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-2 py-1 text-left font-semibold text-ink">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-b border-border px-2 py-1 text-ink">{children}</td>,
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
    const inline = !className
    if (inline) {
      return (
        <code className="rounded border border-border bg-panel px-1 py-[1px] font-mono text-[12px] text-ink">
          {children}
        </code>
      )
    }
    const lang = (className ?? '').replace(/^language-/, '').trim() || undefined
    const text = String(children ?? '').replace(/\n$/, '')
    return <CodeBlock code={text} lang={lang} />
  },
  pre: ({ children }) => <>{children}</>
}

export interface MarkdownProps {
  source: string
  // 본문 래퍼 클래스 override — 미지정 시 채팅 본문 톤(text-ink/leading-1.65).
  // skills 상세 패널 등 다른 톤이 필요한 호출부가 색·행간을 덮어쓴다.
  className?: string
}

const DEFAULT_WRAPPER =
  'text-[13.5px] leading-[1.65] text-ink [&>*:first-child]:mt-0 [&>*:last-child]:mb-0'

// memo: source 는 string(값 비교)이라 기본 shallow 비교로 동일 본문의 unified 재파싱을
// 건너뛴다 — 부모(messageSegments)가 세그먼트 객체를 재생성해도 안전 (0007-transcript-render-memo).
export const Markdown = memo(function Markdown({
  source,
  className
}: MarkdownProps): React.JSX.Element {
  return (
    <div className={className ?? DEFAULT_WRAPPER}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {source}
      </ReactMarkdown>
    </div>
  )
})
