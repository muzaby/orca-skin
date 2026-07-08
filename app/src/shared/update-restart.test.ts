import { describe, expect, it } from 'vitest'
import { canRestartForUpdate } from './update-restart'

const idle = {
  isGenerating: false,
  activeToolCallCount: 0,
  activeDbWriteCount: 0,
  isIndexing: false
}

describe('canRestartForUpdate', () => {
  it('idle 상태에서는 재시작을 허용한다', () => {
    expect(canRestartForUpdate(idle)).toBe(true)
  })

  it.each([
    ['LLM 생성 중', { isGenerating: true }],
    ['활성 tool call 존재', { activeToolCallCount: 1 }],
    ['관측 가능한 DB write section 진행 중', { activeDbWriteCount: 1 }],
    ['파일 인덱싱 중', { isIndexing: true }]
  ])('%s이면 재시작을 막는다', (_label, patch) => {
    expect(canRestartForUpdate({ ...idle, ...patch })).toBe(false)
  })
})
