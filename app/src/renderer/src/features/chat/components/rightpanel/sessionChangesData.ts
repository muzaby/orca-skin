import type { GitDiffSummary, GitStatus } from '../../../../../../shared/ipc'
import type { MessageKey } from '../../../../shared/i18n'
import type { DiffComparison } from './diffComparison'

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
  if (summary.base.kind === 'worktree-base' && summary.base.ref)
    return { kind: 'ref', ref: summary.base.ref }
  return { kind: 'oid', oid: summary.base.oid.slice(0, 7) }
}

/**
 * 위 판정을 화면 문자열로 옮긴다. 비교 기준 **하나**를 말하는 자리이고, 메뉴의
 * `{{base}} 대비` 가 이것을 쓴다. 컨텍스트 바의 두 값 라벨은 `summaryComparisonLabel` 이다.
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

/**
 * 컨텍스트 바의 **두 값** 라벨 — `<기준> → <현재>` (0211 ΔV5 D-104).
 *
 * ΔV4 의 D-069 는 사용자 인용("우측화살표+우측값 표시하지 말것")으로 화살표를 금지했으나,
 * 사용자가 참조 화면을 다시 보고 그 결정을 뒤집었다. `head` 는 지금 체크아웃된 브랜치이고
 * 이미 세션 상태에 있다(`gitStatus.branch`) — 새 조회가 필요 없다.
 *
 * **`head` 가 없으면 화살표도 없다.** detached HEAD·저장소 아님에서 `main → ` 처럼 꼬리가
 * 빈 라벨을 그리면 사용자가 "무엇 대비" 를 읽지 못한다.
 */
/**
 * 라벨은 **비교 모드별로 모양이 다르다** (0211 ΔV6 D-116 · §10 EP-50 ①).
 *
 * 참조 화면이 같은 자리에서 두 문자열을 보인다 — 전체 모드는 `main → feature`, 커밋 모드는
 * `4ea4a51 feat: add hello.txt…`. 한 모양으로 두고 렌더에서만 갈랐다면 커밋 모드가
 * `<sha> → <브랜치>` 라는 **없는 비교**를 그린다. 그래서 판별 유니온이다.
 */
export type ComparisonLabel =
  | { kind: 'range'; base: string; head: string | null }
  | { kind: 'commit'; sha: string; subject: string }

export function summaryComparisonLabel(
  summary: GitDiffSummary | null,
  status: GitStatus | null,
  comparison: DiffComparison,
  tr: (key: MessageKey) => string
): ComparisonLabel {
  if (comparison.kind === 'commit') {
    const commit = summary?.commits.find((entry) => entry.sha === comparison.sha)
    // 고른 커밋이 목록에서 사라졌으면(요약 갱신) 범위 라벨로 접는다 — `reconcileComparison`
    // 이 곧 모드도 되돌리지만, 그 사이 한 프레임에 빈 라벨을 그리지 않는다.
    if (commit) return { kind: 'commit', sha: commit.sha.slice(0, 7), subject: commit.subject }
  }
  const base = summaryBaseText(summary, tr)
  const head = status?.isRepo && !status.detached ? status.branch : null
  // 기준과 현재가 같은 이름이면 화살표가 아무것도 말하지 않는다 — 한 값으로 접는다.
  return { kind: 'range', base, head: head === base ? null : head }
}
