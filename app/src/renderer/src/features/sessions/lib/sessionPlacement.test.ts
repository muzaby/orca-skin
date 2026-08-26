import { describe, expect, it } from 'vitest'
import type { SessionListItem } from '../../../../../shared/ipc'
import { isPinnedSession, placementOf, type SessionPlacement } from './sessionPlacement'

function session(over: Partial<SessionListItem> = {}): SessionListItem {
  return {
    id: 's1',
    backend: 'claude',
    title: null,
    updatedAt: 1,
    preview: null,
    projectId: null,
    cwd: null,
    pinnedAt: null,
    ...over
  }
}

const pinnedProjects = new Set(['p1'])

describe('placementOf', () => {
  it('고정 대화는 프로젝트 소속과 무관하게 고정됨이 가져간다', () => {
    expect(placementOf(session({ pinnedAt: 10 }), pinnedProjects)).toBe('pinned')
    expect(placementOf(session({ pinnedAt: 10, projectId: 'p1' }), pinnedProjects)).toBe('pinned')
  })

  it('고정 프로젝트의 비고정 대화는 그 프로젝트 하위가 가져간다', () => {
    expect(placementOf(session({ projectId: 'p1' }), pinnedProjects)).toBe('pinnedProject')
  })

  it('고정되지 않은 프로젝트의 대화는 최근 대화로 복귀한다', () => {
    expect(placementOf(session({ projectId: 'p2' }), pinnedProjects)).toBe('recent')
    expect(placementOf(session(), pinnedProjects)).toBe('recent')
  })

  // 상호배타·전수성 — 세 섹션의 필터 합이 전체를 정확히 한 번씩 덮는지 고정한다.
  it('모든 조합이 정확히 한 섹션에 배치된다', () => {
    const buckets: SessionPlacement[] = []
    for (const pinnedAt of [null, 10]) {
      for (const projectId of [null, 'p1', 'p2']) {
        buckets.push(placementOf(session({ pinnedAt, projectId }), pinnedProjects))
      }
    }
    expect(buckets).toEqual(['recent', 'pinnedProject', 'recent', 'pinned', 'pinned', 'pinned'])
  })
})

describe('isPinnedSession', () => {
  it('placementOf 의 최우선 분기와 같은 답을 준다', () => {
    for (const pinnedAt of [null, 0, 10]) {
      const s = session({ pinnedAt })
      expect(isPinnedSession(s)).toBe(placementOf(s, pinnedProjects) === 'pinned')
    }
  })
})
