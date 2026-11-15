import { describe, expect, it } from 'vitest'
import { TriggerSpecSchema } from './protocol'
import { isValidTrigger, triggerToCron, type TriggerSpec } from './scheduled-tasks'

describe('triggerToCron', () => {
  it.each<[string, TriggerSpec, string]>([
    ['매시간', { kind: 'hourly' }, '0 * * * *'],
    ['매일 09:30', { kind: 'daily', at: { hour: 9, minute: 30 } }, '30 9 * * *'],
    ['매주 월 09:00', { kind: 'weekly', day: 1, at: { hour: 9, minute: 0 } }, '0 9 * * 1'],
    [
      '지정 월·화·금 09:00',
      { kind: 'custom', days: [1, 2, 5], at: { hour: 9, minute: 0 } },
      '0 9 * * 1,2,5'
    ],
    // 요일 순서가 뒤섞여 저장돼도 cron 은 오름차순이다.
    [
      '지정 금·일 18:30',
      { kind: 'custom', days: [5, 0], at: { hour: 18, minute: 30 } },
      '30 18 * * 0,5'
    ]
  ])('%s', (_name, trigger, cron) => {
    expect(triggerToCron(trigger)).toBe(cron)
  })

  it.each<[string, TriggerSpec]>([
    ['요일 0개', { kind: 'custom', days: [], at: { hour: 9, minute: 0 } }],
    ['요일 중복', { kind: 'custom', days: [1, 1], at: { hour: 9, minute: 0 } }],
    ['시 범위 밖', { kind: 'daily', at: { hour: 24, minute: 0 } }],
    ['분 범위 밖', { kind: 'daily', at: { hour: 9, minute: 60 } }],
    ['요일 범위 밖', { kind: 'weekly', day: 7 as never, at: { hour: 9, minute: 0 } }],
    ['소수 시각', { kind: 'daily', at: { hour: 9.5, minute: 0 } }]
  ])('거부: %s', (_name, trigger) => {
    expect(isValidTrigger(trigger)).toBe(false)
    expect(() => triggerToCron(trigger)).toThrow()
    // IPC 스키마도 같은 규칙으로 거부한다(EP-2 자리 ①).
    expect(TriggerSpecSchema.safeParse(trigger).success).toBe(false)
  })

  it('IPC 스키마가 유효한 네 형태를 그대로 통과시킨다', () => {
    const triggers: TriggerSpec[] = [
      { kind: 'hourly' },
      { kind: 'daily', at: { hour: 9, minute: 30 } },
      { kind: 'weekly', day: 3, at: { hour: 7, minute: 0 } },
      { kind: 'custom', days: [1, 4], at: { hour: 22, minute: 30 } }
    ]
    for (const trigger of triggers) expect(TriggerSpecSchema.parse(trigger)).toEqual(trigger)
  })
})
