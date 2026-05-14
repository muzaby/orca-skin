import { useEffect, useState } from 'react'
import { createHighlighter, type Highlighter } from 'shiki'

const LANGUAGES = [
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'python',
  'bash',
  'json',
  'yaml',
  'html',
  'css',
  'markdown'
] as const

const THEMES = ['github-light', 'github-dark', 'one-light'] as const

// 싱글톤 highlighter — 첫 코드 블록 마운트 시 로드, 이후 동기 호출.
let highlighterPromise: Promise<Highlighter> | null = null
function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [...THEMES],
      langs: [...LANGUAGES]
    })
  }
  return highlighterPromise
}

function pickTheme(): (typeof THEMES)[number] {
  if (typeof document === 'undefined') return 'github-light'
  const t = document.documentElement.dataset.theme
  if (t === 'dark') return 'github-dark'
  if (t === 'cool') return 'one-light'
  return 'github-light'
}

function isLang(s: string): s is (typeof LANGUAGES)[number] {
  return (LANGUAGES as readonly string[]).includes(s)
}

interface CodeBlockProps {
  code: string
  lang?: string
}

/** shiki 비동기 로드 — 첫 마운트 시 plain pre fallback, 로드 후 HTML 교체.
 *  html state 에 어떤 (code, lang, theme) 에 대해 계산됐는지를 함께 저장 —
 *  입력이 바뀌면 자연히 stale 로 간주해 fallback 렌더. 동기 setState 가 없어
 *  `react-hooks/set-state-in-effect` rule 위반을 피한다. */
export function CodeBlock({ code, lang }: CodeBlockProps): React.JSX.Element {
  const theme = useThemeId()
  const safeLang = lang && isLang(lang) ? lang : 'text'
  const [hl, setHl] = useState<{
    code: string
    lang: string
    theme: string
    html: string
  } | null>(null)

  useEffect(() => {
    if (safeLang === 'text') return
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
  }, [code, safeLang, theme])

  const isStale = hl != null && (hl.code !== code || hl.lang !== safeLang || hl.theme !== theme)
  const html = !isStale && hl ? hl.html : null

  if (html) {
    return (
      <div
        className="my-2 overflow-hidden rounded-lg border border-border [&_pre]:m-0 [&_pre]:overflow-auto [&_pre]:p-3 [&_pre]:text-[12.5px] [&_pre]:leading-[1.55]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }
  return (
    <pre className="my-2 overflow-auto rounded-lg border border-border bg-panel p-3 text-[12.5px] leading-[1.55] text-ink">
      <code>{code}</code>
    </pre>
  )
}

function useThemeId(): (typeof THEMES)[number] {
  const [theme, setTheme] = useState<(typeof THEMES)[number]>(() => pickTheme())
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    const obs = new MutationObserver(() => setTheme(pickTheme()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}
