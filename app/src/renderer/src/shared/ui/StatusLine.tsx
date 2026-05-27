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
const ELAPSED_INTERVAL_MS = 1000

function approximateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4))
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n} tokens`
  return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k tokens`
}

// 60s 이상: `Nm Ns`, 60m (3600s) 이상: `Nh Nm Ns`
function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s}s`
  }
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}h ${m}m ${s}s`
}

function pickVerb(): string {
  return VERBS[Math.floor(Math.random() * VERBS.length)]
}

export interface StatusLineProps {
  turnStartedAt: number | null
  /** 스트리밍 중인 어시스턴트 응답 텍스트 — 출력 토큰 동적 추정용. 빈 문자열이면 토큰 절 미표시. */
  outputApproxFromText?: string
  /** Phase B 에서 사용. 현재는 항상 undefined. */
  thinkingActive?: boolean
  thoughtDurationMs?: number
}

export function StatusLine({
  turnStartedAt,
  outputApproxFromText,
  thinkingActive,
  thoughtDurationMs
}: StatusLineProps): React.JSX.Element | null {
  const [symbolIdx, setSymbolIdx] = useState(0)
  // verb 는 한 응답 내에서 고정, 새 응답 (turnStartedAt 변경) 마다 재선택.
  // useMemo 가 turnStartedAt 변경 시 재실행되도록 의도적으로 의존성에 포함.
  const verb = useMemo(() => {
    void turnStartedAt
    return pickVerb()
  }, [turnStartedAt])
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

  const outputTokensLabel = useMemo(() => {
    if (!outputApproxFromText || outputApproxFromText.length === 0) return null
    return `~${formatTokens(approximateTokens(outputApproxFromText))}`
  }, [outputApproxFromText])

  if (turnStartedAt == null) return null

  const elapsedSec = Math.max(0, Math.floor((Math.max(now, turnStartedAt) - turnStartedAt) / 1000))

  const thoughtLabel =
    thinkingActive === true
      ? `thinking for ${elapsedSec}s…`
      : thoughtDurationMs != null && thoughtDurationMs > 0
        ? `thought for ${Math.round(thoughtDurationMs / 1000)}s`
        : null

  const showCounter = elapsedSec >= 5

  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-normal text-ink2">
      <span className="w-3 text-center text-rust" aria-hidden>
        {SYMBOLS[symbolIdx]}
      </span>
      <span>{verb}…</span>
      {showCounter && (
        <span className="font-mono text-[11px] text-ink3">
          ({formatElapsed(elapsedSec)}
          {outputTokensLabel ? ` · ↓ ${outputTokensLabel}` : ''}
          {thoughtLabel ? ` · ${thoughtLabel}` : ''})
        </span>
      )}
    </span>
  )
}
