import type { Project, SessionListItem } from '../../../../../shared/ipc'
import { isPinnedSession, placementOf } from './sessionPlacement'

// 좌측 nav 구획 파생의 **단일 소유자**(0203 ΔV1 EP-1a). 배치 분기가 존재하는 유일한 지점이고,
// 구획 컴포넌트에는 필터가 없다 — 구획이 각자 필터를 들고 있으면 그 필터를 지웠을 때
// 실패하는 장치를 만들 수 없다(verify r1 M1: 세 필터 중 하나를 지워도 전 게이트가 초록이었다).
// 규칙 자체는 sessionPlacement 가 갖고 여기서는 그 규칙으로 목록을 가른다.

export interface NavSectionsInput {
  // 세션 엔티티 정본. 목록들은 여기서 id 로 조회한다.
  byId: Record<string, SessionListItem>
  recentIds: readonly string[]
  pinnedProjectIds: ReadonlySet<string>
  // 조회가 끝난 프로젝트만 키를 갖는다 — 키가 없으면 "아직 조회 안 함"이고 구획이 로딩을 그린다.
  projectSessionIds: Record<string, readonly string[]>
}

export interface NavSections {
  // "고정됨" — 소속과 무관하게 고정된 대화. 고정 시각 내림차순(최근 고정이 위).
  pinned: SessionListItem[]
  // "최근 대화" — recentIds 순서(=updatedAt 내림차순) 중 다른 구획이 가져가지 않은 것.
  recent: SessionListItem[]
  // "프로젝트" 하위 — 고정 프로젝트별 비고정 대화. 키가 없으면 미조회(로딩).
  projectChildren: Record<string, SessionListItem[]>
}

export function splitNavSections(input: NavSectionsInput): NavSections {
  const { byId, recentIds, pinnedProjectIds, projectSessionIds } = input

  const pinned = Object.values(byId)
    .filter(isPinnedSession)
    .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0))

  const recent = recentIds.flatMap((id) => {
    const session = byId[id]
    if (!session || placementOf(session, pinnedProjectIds) !== 'recent') return []
    return [session]
  })

  // 고정 프로젝트의 조회된 버킷만 채운다. 고정이 풀린 프로젝트의 버킷은 nav 에 쓰이지 않으므로
  // 키를 만들지 않는다 — 만들면 소비자가 "미조회"와 "빈 프로젝트"를 구분할 수 없다.
  const projectChildren: Record<string, SessionListItem[]> = {}
  for (const projectId of pinnedProjectIds) {
    const ids = projectSessionIds[projectId]
    if (ids == null) continue
    projectChildren[projectId] = ids.flatMap((id) => {
      const session = byId[id]
      if (!session || isPinnedSession(session)) return []
      return [session]
    })
  }

  return { pinned, recent, projectChildren }
}

// 좌측 nav "프로젝트" 구획의 목록 파생(0203 ΔV1 EP-10). 고정된 것만, 최근 고정이 위.
// hook 안에 두면 순수 테스트가 닿지 못한다 — 그것이 verify r1 의 G3 였다.
export function pinnedProjectsOf(projects: readonly Project[]): Project[] {
  return projects
    .filter((project) => project.pinnedAt != null)
    .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0))
}
