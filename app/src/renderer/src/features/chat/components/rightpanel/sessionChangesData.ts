import type { GitDiffSummary } from '../../../../../../shared/ipc'
import type { MessageKey } from '../../../../shared/i18n'

/**
 * 컨텍스트 바의 비교 기준 라벨 (0211 ΔV4 D-069·D-071).
 *
 * **네 상태다.** `ref` 는 세션이 시작된 시점의 브랜치 이름이고 화면이 그리는 값이다. 그 이름을
 * 모르면(이 변경 이전 세션·detached HEAD) `oid` 7자로 접고, 기준선 자체를 모르면 `head`,
 * 커밋이 하나도 없으면 `none` 이다. 세 번째를 sha 로 그리면 그 sha 가 이 세션의 출발점인 것처럼
 * 읽히므로 문구 자리를 따로 둔다.
 */
export type SummaryBaseLabel =
  { kind: 'ref'; ref: string } | { kind: 'oid'; oid: string } | { kind: 'head' } | { kind: 'none' }

export function summaryBaseLabel(summary: GitDiffSummary | null): SummaryBaseLabel {
  if (!summary || summary.base.kind === 'none') return { kind: 'none' }
  if (summary.base.kind === 'head') return { kind: 'head' }
  if (summary.base.ref) return { kind: 'ref', ref: summary.base.ref }
  return { kind: 'oid', oid: summary.base.oid.slice(0, 7) }
}

/**
 * 위 판정을 화면 문자열로 옮긴다. **여기서 현재 브랜치를 붙이지 않는다** — 사용자가
 * "우측화살표+우측값 표시하지 말것" 을 명시했다(D-069).
 */
export function summaryBaseText(
  summary: GitDiffSummary | null,
  tr: (key: MessageKey) => string
): string {
  const label = summaryBaseLabel(summary)
  if (label.kind === 'ref') return label.ref
  if (label.kind === 'oid') return label.oid
  if (label.kind === 'head') return tr('chat.rightpanel.diffBaselineHead')
  // 커밋이 하나도 없는 저장소. 문자 기호를 그대로 두면 카탈로그 밖 문자열이 화면에 남는다.
  return tr('chat.rightpanel.diffBaselineNone')
}
