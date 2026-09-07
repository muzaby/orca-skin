import { useMemo } from 'react'
import { splitNavSections, type NavSections } from '../lib/navSections'
import { useSessionsState } from '../store/sessionsStore'

// nav 구획 목록의 store 어댑터. 파생 로직은 갖지 않고 lib/navSections 의 파티션을 부른다 —
// 구획 컴포넌트가 store 를 직접 구독하면 SSR 렌더 단언이 성립하지 않는다(zustand 가 초기
// 스냅샷을 돌려줘 목록이 빈 채로 렌더된다, 0203 ΔV1 §7-B 스파이크).
//
// 구독을 구획 안쪽에 두는 이유: app 셸(useSidebarSlots)이 세션 상태를 구독하면 slot
// identity 가 매 변경마다 갈려 Sidebar 의 React.memo 가 무력해진다.
// 세 구획 컴포넌트가 각자 이 훅을 부르고 **각자 전체 파티션을 계산한 뒤 자기 몫 하나만 쓴다**
// — 컴포넌트별 `useMemo` 는 자기 호출만 막을 뿐 셋 사이를 잇지 못한다. 1-entry 모듈 캐시로
// 같은 입력에 대한 두 번째·세 번째 계산을 없앤다. 무효화 축은 아래 `useMemo` 와 **같은 네
// 참조** 라 캐시가 훅보다 오래 살지 않는다.
let cachedInput: SplitInput | null = null
let cachedSections: NavSections | null = null

interface SplitInput {
  byId: Parameters<typeof splitNavSections>[0]['byId']
  recentIds: Parameters<typeof splitNavSections>[0]['recentIds']
  pinnedProjectIds: ReadonlySet<string>
  projectSessionIds: Parameters<typeof splitNavSections>[0]['projectSessionIds']
}

function splitNavSectionsShared(input: SplitInput): NavSections {
  if (
    cachedInput !== null &&
    cachedSections !== null &&
    cachedInput.byId === input.byId &&
    cachedInput.recentIds === input.recentIds &&
    cachedInput.pinnedProjectIds === input.pinnedProjectIds &&
    cachedInput.projectSessionIds === input.projectSessionIds
  )
    return cachedSections
  const sections = splitNavSections(input)
  cachedInput = input
  cachedSections = sections
  return sections
}

export function useNavSections(pinnedProjectIds: ReadonlySet<string>): NavSections {
  const byId = useSessionsState((state) => state.byId)
  const recentIds = useSessionsState((state) => state.recentIds)
  const projectSessionIds = useSessionsState((state) => state.projectSessionIds)

  return useMemo(
    () => splitNavSectionsShared({ byId, recentIds, pinnedProjectIds, projectSessionIds }),
    [byId, recentIds, pinnedProjectIds, projectSessionIds]
  )
}
