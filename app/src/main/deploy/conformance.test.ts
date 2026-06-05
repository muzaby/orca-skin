import { describe, it, expect } from 'vitest'
import { conformanceOf } from './conformance'

describe('conformanceOf', () => {
  it('claude-code 의 표준 적합도를 반환한다', () => {
    const c = conformanceOf('claude-code')
    expect(c.tool.mcp).toBe('native')
    expect(c.tool.transports).toContain('stdio')
    expect(c.tool.transports).toContain('streamable_http')
    expect(c.skill.skillMd).toBe('native')
    expect(c.hook.standardized).toBe(false)
    expect(c.hook.executionModel).toBe('inprocess_throw')
  })
})
