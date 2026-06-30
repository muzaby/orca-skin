import { describe, expect, it } from 'vitest'
import { basenameForDisplay } from './path-basename'

describe('basenameForDisplay', () => {
  it('POSIX와 Windows 구분자를 모두 처리한다', () => {
    expect(basenameForDisplay('/repo/orca')).toBe('orca')
    expect(basenameForDisplay('C:\\repo\\orca')).toBe('orca')
  })

  it('말미 슬래시와 빈 입력은 안전하게 처리한다', () => {
    expect(basenameForDisplay('/repo/orca/')).toBe('orca')
    expect(basenameForDisplay('')).toBe('default')
    expect(basenameForDisplay('/')).toBe('default')
  })
})
