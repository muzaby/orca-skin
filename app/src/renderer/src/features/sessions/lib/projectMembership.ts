import type { SessionListItem } from '../../../../../shared/ipc'

// 최근 조회는 전체 이력이 아니다. 조회한 프로젝트의 과거 ID를 유지하면서 최신 소속을
// 합류시키고, 아직 조회하지 않은 프로젝트는 부분 목록으로 로딩 완료 처리하지 않는다.
export function reconcileProjectMembership(
  current: Record<string, string[]>,
  byId: Record<string, SessionListItem>,
  recentIds: readonly string[]
): Record<string, string[]> {
  let next = current
  for (const [projectId, previous] of Object.entries(current)) {
    const ids = [...new Set([...previous, ...recentIds])]
      .filter((id) => byId[id]?.projectId === projectId)
      .sort((a, b) => byId[b].updatedAt - byId[a].updatedAt)
    if (ids.length === previous.length && ids.every((id, index) => id === previous[index])) continue
    if (next === current) next = { ...current }
    next[projectId] = ids
  }
  return next
}
