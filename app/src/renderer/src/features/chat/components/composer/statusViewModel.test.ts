import { describe, expect, it } from 'vitest'
import { conversationStatusModel } from './statusViewModel'

describe('conversationStatusModel', () => {
  it('safe 는 DOM 없는 상태를 위해 null 을 반환한다', () => {
    expect(conversationStatusModel('safe')).toBeNull()
  })

  it('warn 은 compact 를 추천하고 요약/새 대화 액션을 모두 노출한다', () => {
    const model = conversationStatusModel('warn', '약 $7.80')

    expect(model).toMatchObject({
      state: 'warn',
      recommend: 'compact',
      showCompact: true,
      labels: {
        pill: '대화가 꽤 길어졌어요',
        compactButton: '대화 가볍게 요약하기',
        newChatButton: '정리하고 새 대화 시작',
        costToday: '약 $7.80'
      }
    })
  })

  it('danger 는 새 대화를 추천하고 compact 액션을 숨긴다', () => {
    const model = conversationStatusModel('danger')

    expect(model).toMatchObject({
      state: 'danger',
      recommend: 'newchat',
      showCompact: false,
      labels: {
        pill: '대화가 아주 길어졌어요 — 정리가 필요해요',
        newChatButton: '정리하고 새 대화 시작'
      }
    })
    expect(model?.labels.compactButton).toBeUndefined()
  })
})
