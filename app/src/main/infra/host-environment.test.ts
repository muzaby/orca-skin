// 호스트 환경의 선택 (0324 §11 단계 4 — 경로·버전은 fork 인자).

import { afterEach, describe, expect, it } from 'vitest'
import { hostEnvironment, setHostEnvironment } from './host-environment'
import { testHostEnvironment } from './host-environment.testfixture'

afterEach(() => setHostEnvironment(null))

describe('hostEnvironment', () => {
  it('정하기 전에는 던진다 — 조용히 다른 경로를 쓰지 않는다', () => {
    expect(() => hostEnvironment()).toThrow('호스트 환경이 정해지지 않았다')
  })

  it('정한 값을 돌려주고 null 로 되돌린다', () => {
    const environment = testHostEnvironment({ userData: '/u' })
    setHostEnvironment(environment)
    expect(hostEnvironment()).toBe(environment)
    setHostEnvironment(null)
    expect(() => hostEnvironment()).toThrow()
  })
})
