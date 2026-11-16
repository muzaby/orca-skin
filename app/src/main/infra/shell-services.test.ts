// 셸 서비스 포트의 선택 (0324 EP-10).

import { afterEach, describe, expect, it } from 'vitest'
import { setShellServices, shellServices, type ShellServicesPort } from './shell-services'

afterEach(() => setShellServices(null))

describe('shellServices', () => {
  it('정하기 전에는 던진다 — 조용히 Electron 을 부르지 않는다', () => {
    expect(() => shellServices()).toThrow('셸 서비스가 정해지지 않았다')
  })

  it('정한 포트를 돌려주고 null 로 되돌린다', () => {
    const port: ShellServicesPort = { call: async () => undefined as never, onWake: () => () => {} }
    setShellServices(port)
    expect(shellServices()).toBe(port)
    setShellServices(null)
    expect(() => shellServices()).toThrow()
  })
})
