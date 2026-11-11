import { describe, expect, it } from 'vitest'
import { PromoteBackgroundTaskSchema, StopBackgroundTaskSchema } from './protocol'

// 두 스키마는 세대(generation)를 각자 요구한다 — 공유 base 를 접은 뒤에도 세대 없는 요청이
// 통과하면 지난 세대의 작업을 현재 세대 요청으로 멈추게 된다.
describe('background task request schemas', () => {
  const stop = { sessionId: 's', generation: 'g', taskId: 't' }
  const promote = { sessionId: 's', generation: 'g', toolUseId: 'u' }

  it('accepts a complete stop and promote request', () => {
    expect(StopBackgroundTaskSchema.parse(stop)).toEqual(stop)
    expect(PromoteBackgroundTaskSchema.parse(promote)).toEqual(promote)
  })

  it.each([
    ['stop without generation', StopBackgroundTaskSchema, { sessionId: 's', taskId: 't' }],
    ['stop with empty generation', StopBackgroundTaskSchema, { ...stop, generation: '' }],
    ['stop without taskId', StopBackgroundTaskSchema, { sessionId: 's', generation: 'g' }],
    ['promote without generation', PromoteBackgroundTaskSchema, { sessionId: 's', toolUseId: 'u' }],
    ['promote with empty generation', PromoteBackgroundTaskSchema, { ...promote, generation: '' }],
    ['promote with blank toolUseId', PromoteBackgroundTaskSchema, { ...promote, toolUseId: ' ' }]
  ])('rejects %s', (_name, schema, input) => {
    expect(schema.safeParse(input).success).toBe(false)
  })
})
