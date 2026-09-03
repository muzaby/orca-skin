import { useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { CopyIconButton } from '../CopyIconButton'
import { useI18n } from '../../i18n'
import { MarkdownStreamingContext } from './streamingContext'
import { getThemeSnapshot, subscribeTheme, type ShikiThemeId } from './themeStore'
import { getHighlighter, isLang } from './syntax'

interface CodeBlockProps {
  code: string
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
  '[&_.line]:before:[content:counter(line)] [&_.line]:before:[counter-increment:line] ' +
  '[&_.line]:before:mr-4 [&_.line]:before:inline-block [&_.line]:before:w-6 ' +
  '[&_.line]:before:text-right [&_.line]:before:text-ink3 [&_.line]:before:select-none'

/** shiki 비동기 로드 — 첫 마운트 시 plain pre fallback, 로드 후 HTML 교체.
 *  html state 에 어떤 (code, lang, theme) 에 대해 계산됐는지를 함께 저장 —
 *  입력이 바뀌면 자연히 stale 로 간주해 fallback 렌더. 동기 setState 가 없어
 *  `react-hooks/set-state-in-effect` rule 위반을 피한다. */
export function CodeBlock({
  code,
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
  const [hl, setHl] = useState<{
    code: string
    lang: string
    theme: string
    html: string
  } | null>(null)

  useEffect(() => {
    if (safeLang === 'text' || streaming) return
    let cancelled = false
    getHighlighter().then((h) => {
      if (cancelled) return
      try {
        setHl({ code, lang: safeLang, theme, html: h.codeToHtml(code, { lang: safeLang, theme }) })
      } catch {
        // keep previous html as fallback marker — render path will detect staleness
      }
    })
    return () => {
      cancelled = true
    }
  }, [code, safeLang, theme, streaming])

  const isStale = hl != null && (hl.code !== code || hl.lang !== safeLang || hl.theme !== theme)
  const html = !isStale && hl ? hl.html : null

  // 헤더에 표시할 언어 라벨 — 지원 언어면 safeLang, 미지원이면 원본 lang 그대로,
  // 언어 헤더가 없으면 `text`(언어 식별자 라벨은 로케일 무관 원문 유지).
  const langLabel = safeLang !== 'text' ? safeLang : lang || 'text'

  const header = (
    <div className="flex items-center justify-between border-b border-t5 bg-t1 px-3 py-1 text-caption text-t6">
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
          className={showLineNumbers ? LINE_NUMBER_CLASSES : undefined}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    )
  }
  return (
    <div className={`${shell} ${embedded ? '' : 'bg-t1'}`}>
      {showHeader && header}
      <pre className="m-0 overflow-auto p-3 text-code text-t9">
        <code>{code}</code>
      </pre>
    </div>
  )
}

// 인스턴스별 MutationObserver 대신 모듈 싱글톤 구독(themeStore, 0108).
function useThemeId(): ShikiThemeId {
  return useSyncExternalStore(subscribeTheme, getThemeSnapshot)
}
