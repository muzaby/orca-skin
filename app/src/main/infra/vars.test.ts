import { describe, it, expect } from 'vitest'
import { expandVars, type Resolver } from './vars'
const resolver =
  (map: Record<string, string>): Resolver =>
  (name) =>
    map[name]

describe('expandVars', () => {
  it('평문은 그대로 반환한다', () => {
    expect(expandVars('plain', resolver({}))).toBe('plain')
  })

  it('정의된 ${VAR} 를 치환하고 missing 을 비워 둔다', () => {
    const missing = new Set<string>()
    expect(expandVars('Bearer ${TOKEN}', resolver({ TOKEN: 'secret' }), missing)).toBe(
      'Bearer secret'
    )
    expect([...missing]).toEqual([])
  })

  it('미해결 ${VAR} 를 missing 에 기록한다', () => {
    const missing = new Set<string>()
    expect(expandVars('${MISSING}', resolver({}), missing)).toBe('')
    expect([...missing]).toEqual(['MISSING'])
  })
})
