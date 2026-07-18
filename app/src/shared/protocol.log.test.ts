// LogInputSchema (0123 AC7) — renderer→main 로그 인제스트 신뢰 경계 검증.

import { describe, expect, it } from 'vitest'
import { LogInputSchema } from './protocol'
import { LOG_STRING_MAX_LENGTH } from './logging'

const valid = {
  level: 'info',
  event: 'renderer.boot.completed',
  scope: 'renderer',
  data: { durationMs: 12 }
}

describe('LogInputSchema', () => {
  it('정상 입력을 통과시킨다', () => {
    expect(LogInputSchema.safeParse(valid).success).toBe(true)
    expect(
      LogInputSchema.safeParse({
        level: 'error',
        event: 'renderer.uncaught.error',
        scope: 'renderer',
        error: { name: 'TypeError', message: 'x', stack: 's', cause: { name: 'E', message: 'c' } }
      }).success
    ).toBe(true)
  })

  it('허용 밖 level 을 거부한다', () => {
    expect(LogInputSchema.safeParse({ ...valid, level: 'fatal' }).success).toBe(false)
  })

  it('이벤트 명명 규칙(<domain>.<operation>.<state>) 위반을 거부한다', () => {
    for (const event of [
      'single',
      'Bad.Case.Name',
      'has space.x',
      'a.'.repeat(10) + 'a',
      '.dot.lead'
    ]) {
      expect(LogInputSchema.safeParse({ ...valid, event }).success, event).toBe(false)
    }
  })

  it('공통 필드 위조 시도(strict 밖 키)를 거부한다', () => {
    for (const forged of [
      { appVersion: '99.9.9' },
      { sessionId: 'spoofed' },
      { timestamp: '2020-01-01' },
      { process: 'main' },
      { windowId: 1 }
    ]) {
      expect(LogInputSchema.safeParse({ ...valid, ...forged }).success).toBe(false)
    }
  })

  it('프로토타입 오염 가능 키를 거부한다', () => {
    expect(
      LogInputSchema.safeParse({ ...valid, data: JSON.parse('{"__proto__": {"x": 1}}') }).success
    ).toBe(false)
    expect(
      LogInputSchema.safeParse({ ...valid, data: { nested: { constructor: 'x' } } }).success
    ).toBe(false)
  })

  it('과도한 깊이·문자열 길이를 거부한다', () => {
    let deep: Record<string, unknown> = { leaf: 1 }
    for (let i = 0; i < 8; i++) deep = { nest: deep }
    expect(LogInputSchema.safeParse({ ...valid, data: deep }).success).toBe(false)
    expect(
      LogInputSchema.safeParse({
        ...valid,
        data: { big: 'x'.repeat(LOG_STRING_MAX_LENGTH + 1) }
      }).success
    ).toBe(false)
  })

  it('scope 형식·길이를 제한한다', () => {
    expect(LogInputSchema.safeParse({ ...valid, scope: 'S'.repeat(10) }).success).toBe(false)
    expect(LogInputSchema.safeParse({ ...valid, scope: 'a'.repeat(100) }).success).toBe(false)
  })
})
