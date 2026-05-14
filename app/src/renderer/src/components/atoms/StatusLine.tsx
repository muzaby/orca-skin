import { useEffect, useMemo, useState } from 'react'

const SYMBOLS = ['✢', '✣', '✦', '✧', '★', '✶']

const VERBS = [
  'Pondering',
  'Thinking',
  'Precipitating',
  'Synthesizing',
  'Reasoning',
  'Brewing',
  'Distilling',
  'Ruminating',
  'Mulling',
  'Crystallizing'
]

const SYMBOL_INTERVAL_MS = 200
const VERB_INTERVAL_MS = 3000
const ELAPSED_INTERVAL_MS = 1000

function approximateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4))
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n} tokens`
  return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k tokens`
}

export interface StatusLineProps {
  turnStartedAt: number | null
  /** 사용자 입력 텍스트 (대략 토큰 추정용). result.usage 도착 전 표시. */
  approxFromText?: string
  /** result.usage.inputTokens — 도착 시 approxFromText 대신 표시. */
  inputTokensFinal?: number
  /** Phase B 에서 사용. 현재는 항상 undefined. */
  thinkingActive?: boolean
  thoughtDurationMs?: number
}

export function StatusLine({
  turnStartedAt,
  approxFromText,
  inputTokensFinal,
  thinkingActive,
  thoughtDurationMs
}: StatusLineProps): React.JSX.Element | null {
  const [symbolIdx, setSymbolIdx] = useState(0)
  const [verb, setVerb] = useState(() => VERBS[Math.floor(Math.random() * VERBS.length)])
  // now 는 1s 마다 setInterval 콜백에서 갱신 — effect body 안의 setState 가 아니라
  // 콜백이므로 react-hooks/set-state-in-effect 통과. turnStartedAt 변경 시 lazy
  // initializer 가 재실행되지 않으므로 effect 안에서도 한 번 동기화한다.
  const [now, setNow] = useState<number>(() => turnStartedAt ?? 0)

  useEffect(() => {
    if (turnStartedAt == null) return
    const t = setInterval(() => {
      setNow(Date.now())
    }, ELAPSED_INTERVAL_MS)
    return () => clearInterval(t)
  }, [turnStartedAt])

  useEffect(() => {
    if (turnStartedAt == null) return
    const t = setInterval(() => {
      setSymbolIdx((i) => (i + 1) % SYMBOLS.length)
    }, SYMBOL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [turnStartedAt])

  useEffect(() => {
    if (turnStartedAt == null) return
    const t = setInterval(() => {
      setVerb(VERBS[Math.floor(Math.random() * VERBS.length)])
    }, VERB_INTERVAL_MS)
    return () => clearInterval(t)
  }, [turnStartedAt])

  const tokensLabel = useMemo(() => {
    if (inputTokensFinal != null) return formatTokens(inputTokensFinal)
    if (approxFromText && approxFromText.length > 0) {
      return `~${formatTokens(approximateTokens(approxFromText))}`
    }
    return null
  }, [inputTokensFinal, approxFromText])

  if (turnStartedAt == null) return null

  const elapsedSec = Math.max(0, Math.floor((Math.max(now, turnStartedAt) - turnStartedAt) / 1000))

  const thoughtLabel =
    thinkingActive === true
      ? `thinking for ${elapsedSec}s…`
      : thoughtDurationMs != null && thoughtDurationMs > 0
        ? `thought for ${Math.round(thoughtDurationMs / 1000)}s`
        : null

  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-normal text-ink2">
      <span className="w-3 text-center text-rust" aria-hidden>
        {SYMBOLS[symbolIdx]}
      </span>
      <span>{verb}…</span>
      <span className="font-mono text-[11px] text-ink3">
        ({elapsedSec}s{tokensLabel ? ` · ↑ ${tokensLabel}` : ''}
        {thoughtLabel ? ` · ${thoughtLabel}` : ''})
      </span>
    </span>
  )
}
