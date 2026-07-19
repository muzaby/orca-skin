import { describe, it, expect } from 'vitest'
import { SetSessionPinnedSchema, SetProjectPinnedSchema } from './protocol'

describe('SetSessionPinnedSchema — 세션 고정 토글', () => {
  it('sessionId + pinned(boolean) 을 허용', () => {
    expect(SetSessionPinnedSchema.safeParse({ sessionId: 's1', pinned: true }).success).toBe(true)
    expect(SetSessionPinnedSchema.safeParse({ sessionId: 's1', pinned: false }).success).toBe(true)
  })

  it('빈 sessionId 를 거부', () => {
    expect(SetSessionPinnedSchema.safeParse({ sessionId: '', pinned: true }).success).toBe(false)
  })

  it('pinned 누락 / 비-boolean 을 거부', () => {
    expect(SetSessionPinnedSchema.safeParse({ sessionId: 's1' }).success).toBe(false)
    expect(SetSessionPinnedSchema.safeParse({ sessionId: 's1', pinned: 'yes' }).success).toBe(false)
  })
})

describe('SetProjectPinnedSchema — 프로젝트 고정 토글', () => {
  it('id + pinned(boolean) 을 허용', () => {
    expect(SetProjectPinnedSchema.safeParse({ id: 'p1', pinned: true }).success).toBe(true)
    expect(SetProjectPinnedSchema.safeParse({ id: 'p1', pinned: false }).success).toBe(true)
  })

  it('빈 id / pinned 누락을 거부', () => {
    expect(SetProjectPinnedSchema.safeParse({ id: '', pinned: true }).success).toBe(false)
    expect(SetProjectPinnedSchema.safeParse({ id: 'p1' }).success).toBe(false)
  })
})
