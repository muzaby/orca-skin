import type { MockTreeRow } from './diffTileMock'

// 접힌 디렉토리의 **하위 전체**를 감춘다 — React 없이 도는 순수 파생(0206 D-011).
//
// 트리가 평탄 배열이라 "하위" 는 *접힌 디렉토리 다음에 오는, 그보다 깊은 연속 구간* 이다.
// 그 구간이 끝나는 조건은 `depth <= 접힌 깊이` 인 첫 행이고, 중첩 접힘은 더 얕은 경계가
// 이기므로 경계 깊이 하나만 들고 있으면 된다.
export function visibleTreeRows(
  rows: readonly MockTreeRow[],
  collapsed: ReadonlySet<string>
): MockTreeRow[] {
  const out: MockTreeRow[] = []
  // null = 감추는 중이 아님. 숫자 = 이 깊이 이하를 만나면 다시 보인다.
  let hidingDeeperThan: number | null = null

  for (const row of rows) {
    if (hidingDeeperThan !== null) {
      if (row.depth > hidingDeeperThan) continue
      hidingDeeperThan = null
    }
    out.push(row)
    if (row.kind === 'dir' && collapsed.has(row.key)) hidingDeeperThan = row.depth
  }

  return out
}
