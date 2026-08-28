// 어시스턴트 턴 진행 표시(스트리밍 인디케이터) — 소비자가 chat 전용(transcript ·
// 작업 타일 · 서브에이전트 타일 셋)이라 shared/ui 가 아닌 chat feature 에 둔다. 경과 틱은
// 범용 useElapsed(shared/ui/elapsed)를 공유한다.
// 스피너는 셋이 **분기 없이** 같은 것을 받는다(0208 D-002) — 소비자별 variant 를 두지 않는다.
import { useMemo } from 'react'
import { formatElapsed, useElapsed } from '../../../shared/ui/elapsed'
import { SparkSpinner } from '../../../shared/ui/SparkSpinner'
import { useI18n } from '../../../shared/i18n'
import { deriveActivityLabel, MAX_VISIBLE_FACTS, type ActivityView } from '../lib/activityLabel'

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
  activity?: ActivityView
}

export function StatusLine({
  turnStartedAt,
  outputApproxFromText,
  thinkingActive,
  thoughtDurationMs,
  activity
}: StatusLineProps): React.JSX.Element | null {
  const { tr } = useI18n()
  // verb 는 한 응답 내에서 고정, 새 응답 (turnStartedAt 변경) 마다 재선택.
  // useMemo 가 turnStartedAt 변경 시 재실행되도록 의도적으로 의존성에 포함.
  const verb = useMemo(() => {
    void turnStartedAt
    return pickVerb()
  }, [turnStartedAt])
  // 경과초 1s 틱은 공유 훅(useElapsed)으로 — 서브에이전트 진행 중 메타와 동일 메커니즘.
  const elapsedSec = useElapsed(turnStartedAt)

  const outputTokensLabel = useMemo(() => {
    if (!outputApproxFromText || outputApproxFromText.length === 0) return null
    return `~${formatTokens(approximateTokens(outputApproxFromText))}`
  }, [outputApproxFromText])

  // 재렌더는 경과 초(1s 틱)로만 온다 — 스피너는 CSS 트랙이라 리렌더를 부르지 않는다.
  // 조합 규칙은 순수 모듈이 소유한다(lib/activityLabel) — 여기서는 키를 문구로 옮기기만 한다.
  const label = useMemo(
    () => deriveActivityLabel(activity, elapsedSec * 1000),
    [activity, elapsedSec]
  )
  // 번역도 한 번만 — tooltip(전체)과 인라인(상위 N개)이 같은 배열을 나눠 쓴다.
  const factTexts = useMemo(
    () => label.facts.map((fact) => tr(`chat.activity.${fact.key}`, { count: fact.count })),
    [label, tr]
  )
  const visibleFacts = useMemo(() => {
    const shown = factTexts.slice(0, MAX_VISIBLE_FACTS)
    const overflow = factTexts.length - shown.length
    if (overflow > 0) shown.push(tr('chat.activity.more', { count: overflow }))
    return shown
  }, [factTexts, tr])
  const factLabel = useMemo(() => factTexts.join(' · '), [factTexts])

  if (turnStartedAt == null) return null

  const thoughtLabel =
    thinkingActive === true
      ? `thinking for ${elapsedSec}s…`
      : thoughtDurationMs != null && thoughtDurationMs > 0
        ? `thought for ${Math.round(thoughtDurationMs / 1000)}s`
        : null

  const showCounter = elapsedSec >= 5
  const statusLabel =
    label.status === 'streaming' ? `${verb}…` : tr(`chat.activity.${label.status}`)
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
      <SparkSpinner className="shrink-0 text-rust" />
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
