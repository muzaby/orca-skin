import { useMemo } from 'react'
import { splitNavSections, type NavSections } from '../lib/navSections'
import { useSessionsState } from '../store/sessionsStore'

// nav 구획 목록의 store 어댑터. 파생 로직은 갖지 않고 lib/navSections 의 파티션을 부른다 —
// 구획 컴포넌트가 store 를 직접 구독하면 SSR 렌더 단언이 성립하지 않는다(zustand 가 초기
// 스냅샷을 돌려줘 목록이 빈 채로 렌더된다, 0203 ΔV1 §7-B 스파이크).
//
// 구독을 구획 안쪽에 두는 이유: app 셸(useSidebarSlots)이 세션 상태를 구독하면 slot
// identity 가 매 변경마다 갈려 Sidebar 의 React.memo 가 무력해진다.
export function useNavSections(pinnedProjectIds: ReadonlySet<string>): NavSections {
  const byId = useSessionsState((state) => state.byId)
  const recentIds = useSessionsState((state) => state.recentIds)
  const projectSessionIds = useSessionsState((state) => state.projectSessionIds)

  return useMemo(
    () => splitNavSections({ byId, recentIds, pinnedProjectIds, projectSessionIds }),
    [byId, recentIds, pinnedProjectIds, projectSessionIds]
  )
}
