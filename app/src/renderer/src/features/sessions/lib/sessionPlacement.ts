import type { SessionListItem } from '../../../../../shared/ipc'

// nav 배치 우선순위: 고정 대화 > 고정 프로젝트의 대화 > 최근 대화.
// 한 대화는 정확히 한 섹션에만 나타난다 — 이 규칙을 세 섹션이 각자 필터로 갖고 있으면
// 상호배타·전수성이 어디에도 보장되지 않는다. if/else 사슬 하나로 두 성질을 구조적으로
// 만족시키고, 섹션들은 "이 대화가 내 몫인가"만 묻는다.
export type SessionPlacement = 'pinned' | 'pinnedProject' | 'recent'

export function placementOf(
  session: SessionListItem,
  pinnedProjectIds: ReadonlySet<string>
): SessionPlacement {
  if (isPinnedSession(session)) return 'pinned'
  if (session.projectId != null && pinnedProjectIds.has(session.projectId)) return 'pinnedProject'
  return 'recent'
}

// 고정 대화 판정은 프로젝트 고정과 무관하다 — 최우선 순위라 다른 축을 볼 필요가 없다.
// "고정됨" 섹션과 고정 프로젝트 하위 목록이 이 술어 하나를 공유한다.
export function isPinnedSession(session: SessionListItem): boolean {
  return session.pinnedAt != null
}
