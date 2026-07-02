import { describe, expect, it } from 'vitest'
import { conversationStatusModel } from './statusViewModel'

// 0062 r2 (사용자 확정): 단계별 단일 권장 액션 — warn = 현재 세션 /compact 전송,
// danger = 핸드오프. "정리하고 새 대화 시작" 은 제거.
describe('conversationStatusModel', () => {
  it('safe 는 DOM 없는 상태를 위해 null 을 반환한다', () => {
    expect(conversationStatusModel('safe')).toBeNull()
  })

  it('warn 은 /compact(요약) 단일 액션을 노출한다', () => {
    const model = conversationStatusModel('warn', '약 $7.80')

    expect(model).toMatchObject({
      state: 'warn',
      action: 'compact',
      labels: {
        pill: '대화가 꽤 길어졌어요',
        actionButton: '대화 가볍게 요약하기',
        costToday: '약 $7.80'
      }
    })
  })

  it('danger 는 핸드오프 단일 액션을 노출한다', () => {
    const model = conversationStatusModel('danger')

    expect(model).toMatchObject({
      state: 'danger',
      action: 'handoff',
      labels: {
        pill: '대화가 아주 길어졌어요 — 정리가 필요해요',
        actionButton: '핸드오프로 이어가기'
      }
    })
  })
})
