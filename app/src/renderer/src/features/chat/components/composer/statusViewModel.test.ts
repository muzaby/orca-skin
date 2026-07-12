import { describe, expect, it } from 'vitest'
import { conversationStatusModel } from './statusViewModel'
import { ko } from '../../../../shared/i18n/resources/ko'

function koLeaf(path: string): string | undefined {
  const value = path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        typeof acc === 'object' && acc !== null ? (acc as Record<string, unknown>)[key] : undefined,
      ko
    )
  return typeof value === 'string' ? value : undefined
}

// 0064 r2 (사용자 확정): 단계별 단일 권장 액션 — warn = 현재 세션 /compact 전송,
// danger = 핸드오프. "정리하고 새 대화 시작" 은 제거. 카피는 카탈로그 키(labelKeys)로
// 노출되고 렌더가 tr() 해석한다(0097) — ko 해석 결과가 기존 카피와 동일함을 함께 고정.
describe('conversationStatusModel', () => {
  it('safe 는 DOM 없는 상태를 위해 null 을 반환한다', () => {
    expect(conversationStatusModel('safe')).toBeNull()
  })

  it('warn 은 /compact(요약) 단일 액션을 노출한다', () => {
    const model = conversationStatusModel('warn', '약 $7.80')

    expect(model).toMatchObject({
      state: 'warn',
      action: 'compact',
      costToday: '약 $7.80',
      labelKeys: {
        pill: 'chat.status.warn.pill',
        actionButton: 'chat.status.warn.actionButton'
      }
    })
    expect(koLeaf(model!.labelKeys.pill)).toBe('대화가 꽤 길어졌어요')
    expect(koLeaf(model!.labelKeys.actionButton)).toBe('대화 가볍게 요약하기')
  })

  it('danger 는 핸드오프 단일 액션을 노출한다', () => {
    const model = conversationStatusModel('danger')

    expect(model).toMatchObject({
      state: 'danger',
      action: 'handoff',
      labelKeys: {
        pill: 'chat.status.danger.pill',
        actionButton: 'chat.status.danger.actionButton'
      }
    })
    expect(model!.costToday).toBeUndefined()
    expect(koLeaf(model!.labelKeys.pill)).toBe('대화가 아주 길어졌어요 — 정리가 필요해요')
    expect(koLeaf(model!.labelKeys.actionButton)).toBe('핸드오프로 이어가기')
  })
})
