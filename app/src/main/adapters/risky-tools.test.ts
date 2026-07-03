import { describe, it, expect } from 'vitest'
import { isRiskyTool } from './risky-tools'

describe('isRiskyTool (위험 도구 게이트 화이트리스트)', () => {
  it('상태 변경 도구는 위험으로 분류', () => {
    for (const t of ['Bash', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit']) {
      expect(isRiskyTool(t)).toBe(true)
    }
  })

  it('읽기 전용/조회 도구는 비위험(자동 통과)', () => {
    for (const t of ['Read', 'Glob', 'Grep', 'WebFetch', 'TodoWrite']) {
      expect(isRiskyTool(t)).toBe(false)
    }
  })

  it('알 수 없는 도구 이름은 비위험(화이트리스트 외)', () => {
    expect(isRiskyTool('SomeRandomTool')).toBe(false)
    expect(isRiskyTool('')).toBe(false)
  })
})
