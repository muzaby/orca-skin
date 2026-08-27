import { describe, expect, it } from 'vitest'
import type { Project, SessionListItem } from '../../../../../shared/ipc'
import { pinnedProjectsOf, splitNavSections, type NavSectionsInput } from './navSections'

function session(id: string, over: Partial<SessionListItem> = {}): SessionListItem {
  return {
    id,
    backend: 'claude',
    title: id,
    updatedAt: 1,
    preview: null,
    projectId: null,
    cwd: null,
    pinnedAt: null,
    ...over
  }
}

function project(id: string, pinnedAt: number | null): Project {
  return { id, name: id, instructions: '', createdAt: 0, updatedAt: 0, pinnedAt }
}

// (고정 × 소속) 전 조합. 소속 축은 미소속 · 고정 프로젝트 · 비고정 프로젝트 셋이다.
const COMBOS: SessionListItem[] = [
  session('n-none'),
  session('n-pinnedProj', { projectId: 'p1' }),
  session('n-plainProj', { projectId: 'p2' }),
  session('p-none', { pinnedAt: 10 }),
  session('p-pinnedProj', { pinnedAt: 20, projectId: 'p1' }),
  session('p-plainProj', { pinnedAt: 30, projectId: 'p2' })
]

// 전 조합이 recents 에 있고 고정 프로젝트 버킷이 조회된 상태 — 배치 규칙만 남긴 입력이다.
function fullyLoaded(items: SessionListItem[] = COMBOS): NavSectionsInput {
  return {
    byId: Object.fromEntries(items.map((s) => [s.id, s])),
    recentIds: items.map((s) => s.id),
    pinnedProjectIds: new Set(['p1']),
    projectSessionIds: { p1: items.filter((s) => s.projectId === 'p1').map((s) => s.id) }
  }
}

const idsOf = (items: SessionListItem[]): string[] => items.map((s) => s.id)

describe('splitNavSections — 배치 파티션 (EP-1a)', () => {
  it('고정 대화는 소속과 무관하게 "고정됨"이 가져가고 최근 고정이 위다', () => {
    const { pinned } = splitNavSections(fullyLoaded())
    expect(idsOf(pinned)).toEqual(['p-plainProj', 'p-pinnedProj', 'p-none'])
  })

  it('고정 프로젝트의 비고정 대화는 그 프로젝트 하위가 가져간다', () => {
    const { projectChildren } = splitNavSections(fullyLoaded())
    expect(idsOf(projectChildren.p1)).toEqual(['n-pinnedProj'])
  })

  it('나머지는 최근 대화가 가져간다 — recentIds 순서를 보존한다', () => {
    const { recent } = splitNavSections(fullyLoaded())
    expect(idsOf(recent)).toEqual(['n-none', 'n-plainProj'])
  })

  // AT-06a — 서로소 + 합집합. 완결성 주장의 관측은 합계가 아니라 **양방향 차집합**이다.
  it('세 구획이 서로소이고 합집합이 입력과 같다', () => {
    const { pinned, recent, projectChildren } = splitNavSections(fullyLoaded())
    const buckets = [idsOf(pinned), idsOf(recent), ...Object.values(projectChildren).map(idsOf)]

    for (let i = 0; i < buckets.length; i += 1) {
      for (let j = i + 1; j < buckets.length; j += 1) {
        const overlap = buckets[i].filter((id) => buckets[j].includes(id))
        expect(overlap).toEqual([])
      }
    }

    const placed = new Set(buckets.flat())
    const input = new Set(idsOf(COMBOS))
    expect([...input].filter((id) => !placed.has(id))).toEqual([]) // 배치 안 된 것 0
    expect([...placed].filter((id) => !input.has(id))).toEqual([]) // 없는 것을 배치 0
    expect(buckets.flat().length).toBe(placed.size) // 중복 배치 0
  })

  // AT-05a — 고정은 복제가 아니라 **이동**이다(D-005).
  it('대화를 고정하면 고정됨에만 남고 원래 구획에서 사라진다', () => {
    const before = splitNavSections(fullyLoaded())
    expect(idsOf(before.recent)).toContain('n-none')

    const moved = COMBOS.map((s) => (s.id === 'n-none' ? { ...s, pinnedAt: 99 } : s))
    const after = splitNavSections(fullyLoaded(moved))

    expect(idsOf(after.pinned)).toContain('n-none')
    expect(idsOf(after.recent)).not.toContain('n-none')
    expect(idsOf(after.projectChildren.p1)).not.toContain('n-none')
  })

  it('프로젝트 하위 대화를 고정해도 프로젝트 하위에서 사라진다', () => {
    const moved = COMBOS.map((s) => (s.id === 'n-pinnedProj' ? { ...s, pinnedAt: 99 } : s))
    const after = splitNavSections(fullyLoaded(moved))
    expect(idsOf(after.pinned)).toContain('n-pinnedProj')
    expect(idsOf(after.projectChildren.p1)).toEqual([])
  })

  // AT-07a — 해제하면 소속에 따라 원래 자리로 돌아온다.
  it('고정 해제 시 소속이 고정 프로젝트면 그 하위로, 아니면 최근 대화로 복귀한다', () => {
    const released = COMBOS.map((s) =>
      s.id === 'p-pinnedProj' || s.id === 'p-none' ? { ...s, pinnedAt: null } : s
    )
    const after = splitNavSections(fullyLoaded(released))
    expect(idsOf(after.projectChildren.p1)).toContain('p-pinnedProj')
    expect(idsOf(after.recent)).toContain('p-none')
    expect(idsOf(after.pinned)).toEqual(['p-plainProj'])
  })

  // AT-14 — 무관한 변경이 다른 구획의 내용을 바꾸지 않는다.
  it('한 구획에만 영향 주는 변경이 나머지 두 구획의 내용을 바꾸지 않는다', () => {
    const before = splitNavSections(fullyLoaded())
    const renamed = COMBOS.map((s) => (s.id === 'p-none' ? { ...s, title: '이름바뀜' } : s))
    const after = splitNavSections(fullyLoaded(renamed))

    expect(idsOf(after.recent)).toEqual(idsOf(before.recent))
    expect(idsOf(after.projectChildren.p1)).toEqual(idsOf(before.projectChildren.p1))
  })

  it('미조회 프로젝트는 키를 만들지 않아 소비자가 로딩과 빈 목록을 구분한다', () => {
    const input = fullyLoaded()
    const { projectChildren } = splitNavSections({ ...input, projectSessionIds: {} })
    expect(projectChildren.p1).toBeUndefined()
  })

  // 알려진 경계(0203 D3, NEXT_HANDOFF). 여기서 고치지 않고 **관측으로 고정**한다 —
  // 적어 두지 않으면 위 합집합 단언이 이 경우까지 덮는 것처럼 읽힌다.
  it('미조회 고정 프로젝트의 대화는 어느 구획에도 배치되지 않는다 (D3)', () => {
    const input = fullyLoaded()
    const { pinned, recent, projectChildren } = splitNavSections({
      ...input,
      projectSessionIds: {}
    })
    const placed = [
      ...idsOf(pinned),
      ...idsOf(recent),
      ...Object.values(projectChildren).flatMap(idsOf)
    ]
    expect(placed).not.toContain('n-pinnedProj')
  })
})

describe('pinnedProjectsOf — 고정 프로젝트 파생 (EP-10)', () => {
  it('고정된 것만 최근 고정 순으로 남긴다', () => {
    const result = pinnedProjectsOf([project('a', null), project('b', 1), project('c', 2)])
    expect(result.map((p) => p.id)).toEqual(['c', 'b'])
  })

  it('고정이 하나도 없으면 빈 목록이다', () => {
    expect(pinnedProjectsOf([project('a', null)])).toEqual([])
  })
})
