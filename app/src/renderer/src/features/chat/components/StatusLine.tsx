// 어시스턴트 턴 진행 표시(스트리밍 인디케이터) — 소비자가 chat 전용(transcript ·
// 서브에이전트 타일)이라 shared/ui 가 아닌 chat feature 에 둔다. 경과 틱은 범용
// useElapsed(shared/ui/elapsed)를 공유한다.
import { useEffect, useMemo, useState } from 'react'
import { formatElapsed, useElapsed } from '../../../shared/ui/elapsed'
import { useI18n } from '../../../shared/i18n'

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
const LONG_WAIT_SECONDS = 30

function approximateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4))
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n} tokens`
  return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k tokens`
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
  activity?: {
    foreground: 'idle' | 'preparing' | 'streaming'
    queuedCount: number
    deliveryPendingCount: number
    residualCount: number
    backgroundTaskCount: number
    listening: boolean
  }
}

export function StatusLine({
  turnStartedAt,
  outputApproxFromText,
  thinkingActive,
  thoughtDurationMs,
  activity
}: StatusLineProps): React.JSX.Element | null {
  const { tr } = useI18n()
  const [symbolIdx, setSymbolIdx] = useState(0)
  // verb 는 한 응답 내에서 고정, 새 응답 (turnStartedAt 변경) 마다 재선택.
  // useMemo 가 turnStartedAt 변경 시 재실행되도록 의도적으로 의존성에 포함.
  const verb = useMemo(() => {
    void turnStartedAt
    return pickVerb()
  }, [turnStartedAt])
  // 경과초 1s 틱은 공유 훅(useElapsed)으로 — 서브에이전트 진행 중 메타와 동일 메커니즘.
  const elapsedSec = useElapsed(turnStartedAt)

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

  const thoughtLabel =
    thinkingActive === true
      ? `thinking for ${elapsedSec}s…`
      : thoughtDurationMs != null && thoughtDurationMs > 0
        ? `thought for ${Math.round(thoughtDurationMs / 1000)}s`
        : null

  const showCounter = elapsedSec >= 5
  // residual은 deliveryPending의 부분집합이다. 그대로 나열하면 같은 메시지를
  // "전달 확인"과 "중단 후 전달 대기"로 두 번 세므로, 일반 전달분만 차감해 보여준다.
  const ordinaryDeliveryPending = activity
    ? Math.max(0, activity.deliveryPendingCount - activity.residualCount)
    : 0
  const facts = [
    ordinaryDeliveryPending > 0
      ? tr('chat.activity.deliveryPending', { count: ordinaryDeliveryPending })
      : null,
    activity && activity.queuedCount > 0
      ? tr('chat.activity.queued', { count: activity.queuedCount })
      : null,
    activity && activity.residualCount > 0
      ? tr('chat.activity.residual', { count: activity.residualCount })
      : null,
    activity && activity.backgroundTaskCount > 0
      ? tr('chat.activity.background', { count: activity.backgroundTaskCount })
      : null
  ].filter((fact): fact is string => fact != null)
  const visibleFacts = facts.slice(0, 2)
  if (facts.length > visibleFacts.length) {
    visibleFacts.push(tr('chat.activity.more', { count: facts.length - visibleFacts.length }))
  }
  const waiting =
    activity != null &&
    (activity.listening || facts.length > 0 || activity.foreground === 'preparing')
  const statusLabel =
    activity?.foreground === 'preparing'
      ? tr('chat.activity.preparing')
      : waiting && activity?.foreground === 'idle'
        ? elapsedSec >= LONG_WAIT_SECONDS
          ? tr('chat.activity.finishingSlow')
          : tr('chat.activity.waiting')
        : `${verb}…`
  const factLabel = facts.join(' · ')
  const accessibleLabel = [statusLabel, factLabel, showCounter ? formatElapsed(elapsedSec) : null]
    .filter(Boolean)
    .join(', ')

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] font-normal text-ink2"
      aria-live="polite"
      aria-label={accessibleLabel}
      title={factLabel || undefined}
    >
      <span className="w-3 text-center text-rust motion-reduce:hidden" aria-hidden>
        {SYMBOLS[symbolIdx]}
      </span>
      <span className="hidden w-3 text-center text-rust motion-reduce:inline" aria-hidden>
        ✦
      </span>
      <span aria-hidden>{statusLabel}</span>
      {visibleFacts.length > 0 && (
        <span className="text-[11px] text-ink3" aria-hidden>
          · {visibleFacts.join(' · ')}
        </span>
      )}
      {showCounter && (
        <span className="font-mono text-[11px] text-ink3" aria-hidden>
          ({formatElapsed(elapsedSec)}
          {outputTokensLabel ? ` · ↓ ${outputTokensLabel}` : ''}
          {thoughtLabel ? ` · ${thoughtLabel}` : ''})
        </span>
      )}
    </span>
  )
}
