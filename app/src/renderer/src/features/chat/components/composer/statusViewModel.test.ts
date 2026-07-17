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
// danger = 핸드오프. 카피는 카탈로그 키(labelKeys)로 노출되고 렌더가 tr() 해석한다(0097).
// 0122: 오늘 사용량/비용/디스클레이머 제거, 대화 길이 행에 병기할 수치(contextUsage) 계산.
describe('conversationStatusModel', () => {
  it('safe 는 DOM 없는 상태를 위해 null 을 반환한다', () => {
    expect(conversationStatusModel('safe')).toBeNull()
  })

  it('warn 은 /compact(요약) 단일 액션을 노출한다', () => {
    const model = conversationStatusModel('warn', { tokens: 138_000, window: 200_000 })

    expect(model).toMatchObject({
      state: 'warn',
      action: 'compact',
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
    expect(koLeaf(model!.labelKeys.pill)).toBe('대화가 아주 길어졌어요 — 정리가 필요해요')
    expect(koLeaf(model!.labelKeys.actionButton)).toBe('핸드오프로 이어가기')
  })

  it('usage 를 받으면 k 반올림 수치와 퍼센트를 계산한다 (138k/200k 69%)', () => {
    const model = conversationStatusModel('warn', { tokens: 138_400, window: 200_000 })

    expect(model!.contextUsage).toEqual({ usedK: 138, windowK: 200, pct: 69 })
    // 렌더는 chat.status.lengthValue 로 포맷 — 카탈로그 원문을 함께 고정한다.
    expect(koLeaf('chat.status.lengthValue')).toBe('{{used}}k/{{window}}k {{pct}}%')
  })

  it('1M 컨텍스트 윈도우는 1000k 로 표기한다', () => {
    const model = conversationStatusModel('danger', { tokens: 870_000, window: 1_000_000 })

    expect(model!.contextUsage).toEqual({ usedK: 870, windowK: 1000, pct: 87 })
  })

  it('usage 미제공/비정상 윈도우면 contextUsage 를 생략한다', () => {
    expect(conversationStatusModel('warn')!.contextUsage).toBeUndefined()
    expect(conversationStatusModel('warn', { tokens: 1, window: 0 })!.contextUsage).toBeUndefined()
  })
})
