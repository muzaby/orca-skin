import { useContext, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { CopyIconButton } from '../CopyIconButton'
import { useI18n } from '../../i18n'
import { MarkdownStreamingContext } from './streamingContext'
import { getThemeSnapshot, subscribeTheme, type ShikiThemeId } from './themeStore'
import { isLang } from './syntax'
import { HIGHLIGHT_MAX_CHARS } from '../../compute/limits'
import type { MarkedText } from './sourceParts'
import { useHighlightedHtml } from '../../compute/useHighlightedHtml'

interface CodeBlockProps {
  code: string
  markedText?: readonly MarkedText[]
  lang?: string
  // shiki 의 줄별 `<span class="line">` 에 CSS 카운터로 라인넘버 거터를 붙인다(Read 등).
  showLineNumbers?: boolean
  // tool-body 안에 임베드될 때 — 바깥 카드 크롬(border/rounded/bg/margin) 제거.
  // ToolCard 본문이 이미 단일 카드를 제공하므로 이중 컨테이너 중첩을 막는다.
  embedded?: boolean
  // 언어 라벨 + 복사 헤더 표시 여부. ToolCard 헤더가 경로/복사를 이미 제공하면 false.
  showHeader?: boolean
}

// shiki `.line` 스팬에 라인넘버 ::before 거터. 새 CSS 없이 Tailwind arbitrary 유틸로만.
const LINE_NUMBER_CLASSES =
  '[&_code]:[counter-reset:line] ' +
  '[&_.line]:before:content-[counter(line)] [&_.line]:before:[counter-increment:line] ' +
  '[&_.line]:before:mr-4 [&_.line]:before:inline-block [&_.line]:before:w-6 ' +
  '[&_.line]:before:text-right [&_.line]:before:text-ink3 [&_.line]:before:select-none'

/** 구문 강조는 계산 워커가 한다(0324) — 응답 전에는 plain pre, 응답 후 HTML 로 교체한다.
 *  입력이 바뀌면 이전 결과는 stale 로 보고 다시 원문을 그린다. */
export function CodeBlock({
  code,
  markedText,
  lang,
  showLineNumbers,
  embedded,
  showHeader = true
}: CodeBlockProps): React.JSX.Element {
  const { tr } = useI18n()
  const theme = useThemeId()
  // 스트리밍 tail 안에서는 하이라이트를 건너뛴다(0108) — 열린 펜스의 code 가 프레임마다
  // 자라며 매번 전체 재하이라이트(O(n²))와 plain↔색상 플리커를 만든다. 블록이 stable 로
  // 승격되거나 message.completed 커밋 렌더로 교체되면 streaming=false 로 1회 하이라이트.
  const streaming = useContext(MarkdownStreamingContext)
  const safeLang = lang && isLang(lang) ? lang : 'text'
  // 출력 뷰어는 큰 파일도 연다. 큰 원문은 그대로 읽고 강조는 상한 이하에만 요청한다 — 강조
  // 결과를 DOM 에 넣는 일이 UI 스레드에 남기 때문이다(0324 D-012).
  const highlight = safeLang !== 'text' && !streaming && code.length <= HIGHLIGHT_MAX_CHARS
  const html = useHighlightedHtml(code, safeLang, theme, highlight)

  const highlightedRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!markedText?.length) return
    const codeElement = highlightedRef.current?.querySelector('code')
    if (!codeElement) return
    markHighlightedCode(codeElement, markedText)
    return () => markHighlightedCode(codeElement)
  }, [html, markedText])

  // 헤더에 표시할 언어 라벨 — 지원 언어면 safeLang, 미지원이면 원본 lang 그대로,
  // 언어 헤더가 없으면 `text`(언어 식별자 라벨은 로케일 무관 원문 유지).
  const langLabel = safeLang !== 'text' ? safeLang : lang || 'text'

  const header = (
    <div
      data-transcript-chrome=""
      className="flex items-center justify-between border-b border-t5 bg-t1 px-3 py-1 text-caption text-t6"
    >
      <span className="font-mono lowercase">{langLabel}</span>
      <div className="opacity-0 transition-opacity duration-150 ease-[cubic-bezier(0.215,0.61,0.355,1)] motion-reduce:transition-none group-hover/codeblock:opacity-100 focus-within:opacity-100">
        <CopyIconButton text={code} title={tr('common.copyCode')} />
      </div>
    </div>
  )

  // embedded: ToolCard 본문이 이미 카드라 바깥 크롬 제거. 산문 코드블록은 자체 카드 유지.
  const shell = embedded
    ? 'group/codeblock overflow-hidden'
    : 'group/codeblock my-2 overflow-hidden rounded-r6 border border-t5'

  if (html) {
    return (
      <div className={`${shell} [&_pre]:m-0 [&_pre]:overflow-auto [&_pre]:p-3 [&_pre]:text-code`}>
        {showHeader && header}
        <div
          ref={highlightedRef}
          className={showLineNumbers ? LINE_NUMBER_CLASSES : undefined}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    )
  }
  return (
    <div className={`${shell} ${embedded ? '' : 'bg-t1'}`}>
      {showHeader && header}
      <pre className={`m-0 overflow-auto p-3 text-code text-t9 ${showLineNumbers ? 'flex' : ''}`}>
        {showLineNumbers && (
          <span
            aria-hidden="true"
            data-transcript-chrome=""
            className="mr-4 shrink-0 select-none text-right text-ink3"
          >
            {Array.from({ length: code.split('\n').length }, (_, index) => index + 1).join('\n')}
          </span>
        )}
        <code>
          {markedText?.length
            ? markedText.map((run) => (
                <span key={run.key} data-part-key={run.key} data-markdown-part-fragment="">
                  {run.text}
                </span>
              ))
            : code}
        </code>
      </pre>
    </div>
  )
}

// React owns the surrounding shell and Shiki owns this HTML subtree. Splitting its text
// preserves the existing highlighting tokens and keeps their rendered offsets addressable.
function markHighlightedCode(root: Element, runs?: readonly MarkedText[]): void {
  for (const marker of root.querySelectorAll('[data-markdown-part-fragment]')) {
    marker.replaceWith(root.ownerDocument.createTextNode(marker.textContent ?? ''))
  }
  if (!runs?.length) return
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text)

  let runIndex = 0
  let consumed = 0
  for (const node of nodes) {
    const fragment = root.ownerDocument.createDocumentFragment()
    let offset = 0
    while (offset < node.length && runIndex < runs.length) {
      const run = runs[runIndex]
      const count = Math.min(node.length - offset, run.text.length - consumed)
      if (count > 0) {
        const span = root.ownerDocument.createElement('span')
        span.setAttribute('data-part-key', run.key)
        span.setAttribute('data-markdown-part-fragment', '')
        span.textContent = node.data.slice(offset, offset + count)
        fragment.append(span)
        offset += count
        consumed += count
      }
      if (consumed === run.text.length) {
        runIndex++
        consumed = 0
      }
    }
    if (offset < node.length) fragment.append(node.data.slice(offset))
    node.replaceWith(fragment)
  }
}

// 인스턴스별 MutationObserver 대신 모듈 싱글톤 구독(themeStore, 0108).
function useThemeId(): ShikiThemeId {
  return useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeSnapshot)
}
