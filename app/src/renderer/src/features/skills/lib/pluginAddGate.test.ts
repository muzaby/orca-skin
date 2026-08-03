import { describe, expect, it } from 'vitest'
import { showsAddButton } from './pluginAddGate'

describe('showsAddButton', () => {
  it('기본값은 숨김', () => {
    // 서버 목록의 정본은 빌드타임(`servers.ts`)이다 — 사용자가 주소를 타이핑하는 입구를
    // 기본으로 열어두면 "여기서 만들면 되는구나" 로 읽힌다.
    expect(showsAddButton('plugins', false)).toBe(false)
  })

  it('토글을 켜면 노출', () => {
    expect(showsAddButton('plugins', true)).toBe(true)
  })

  it('skills·mcp 는 토글과 무관하게 늘 보인다', () => {
    expect(showsAddButton('skills', false)).toBe(true)
    expect(showsAddButton('mcp', false)).toBe(true)
  })
})
