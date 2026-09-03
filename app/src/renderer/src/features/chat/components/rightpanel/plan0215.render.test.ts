import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// 0215 VP-01 (R-01 ↔ AT-03 · §10 EP-04) — 승인 대기 중 본문이 없으면 **실패**를 보인다.
//
// `PlanTileContent` 는 store 를 읽는다. `renderToStaticMarkup` 은 zustand SSR 스냅샷을
// 돌려주므로 store 모듈을 통째로 모킹해 시드를 흘린다(선례 `taskTile0213.render.test.ts`).
const { planState } = vi.hoisted(() => ({
  planState: {
    value: {
      planContent: null as string | null,
      pendingPlanReview: null as unknown,
      planComments: [] as unknown[],
      activePlanCommentId: null as string | null
    }
  }
}))

vi.mock('../../store/chatStore', () => ({
  chatActions: {
    addPlanComment: vi.fn(),
    updatePlanComment: vi.fn(),
    removePlanComment: vi.fn(),
    setActivePlanComment: vi.fn()
  },
  useChatSession: (select: (s: unknown) => unknown) => select(planState.value)
}))

const { PlanTileContent } = await import('./PlanTileContent')

const render = (state: Partial<(typeof planState)['value']>): string => {
  planState.value = {
    planContent: null,
    pendingPlanReview: null,
    planComments: [],
    activePlanCommentId: null,
    ...state
  }
  return renderToStaticMarkup(createElement(PlanTileContent))
}

const EMPTY = '아직 플랜이 없습니다'
const UNAVAILABLE = '계획 본문을 가져오지 못했습니다'

describe('PlanTileContent — 본문 미해소 표시 (AT-03 · D-002)', () => {
  it('승인 대기 중인데 본문이 없으면 실패 문구를 낸다', () => {
    const html = render({ pendingPlanReview: { requestId: 'r1', plan: '' } })
    expect(html).toContain(UNAVAILABLE)
    // 음성 짝 — 평시 빈 문구로 떨어지지 않는다. 두 상태가 같은 화면이면 실패가 숨는다.
    expect(html).not.toContain(EMPTY)
  })

  it('승인 요청이 없으면 기존 빈 문구 그대로다 — 형제 상태가 맞바뀌지 않는다', () => {
    const html = render({})
    expect(html).toContain(EMPTY)
    expect(html).not.toContain(UNAVAILABLE)
  })

  it('본문이 있으면 마크다운을 그린다 — 두 빈 상태 어느 쪽도 아니다', () => {
    const html = render({
      planContent: '## 계획\n- 파서를 고친다',
      pendingPlanReview: { requestId: 'r1', plan: '## 계획' }
    })
    expect(html).toContain('파서를 고친다')
    expect(html).not.toContain(UNAVAILABLE)
    expect(html).not.toContain(EMPTY)
  })
})
