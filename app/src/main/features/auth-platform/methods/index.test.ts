// 내장 인증 방식 목록 (0178 §4) — **SSO 가 배선돼 있는지**를 고정한다.
//
// 0178 이전에는 브라우저 세션 구현체가 존재하는데 어떤 등록 목록에도 없었다 — 유일한 비-test
// 참조가 미등록 예제 디렉토리였다. 즉 코드는 있는데 SSO 로그인 자체가 동작하지 않았다.
// 이 파일이 고정하는 것은 "설정을 채우면 실제로 목록에 들어간다" 이다.

import { describe, expect, it } from 'vitest'
import { AUTH_METHODS, createBrowserSessionMethod } from './index'
import { BASIC_METHOD_ID, PAT_METHOD_ID } from './credential'
import { SSO_CONFIG } from './sso'
import { AuthRegistry } from '../registry'

const SSO_SAMPLE = {
  id: 'corp-sso',
  label: '사내 SSO',
  sessionGroup: 'corp',
  loginUrl: 'https://sso.corp.invalid/adfs/ls',
  doneUrlPrefix: 'https://portal.corp.invalid/home',
  authenticationProbeUrl: 'https://portal.corp.invalid/api/me',
  allowedOrigins: ['https://sso.corp.invalid', 'https://portal.corp.invalid']
} as const

describe('AUTH_METHODS — 내장 목록', () => {
  it('자격증명 2종이 항상 들어 있고 서비스 연결 전용이다', () => {
    const byId = new Map(AUTH_METHODS.map((m) => [m.descriptor.id, m]))
    expect(byId.get(PAT_METHOD_ID)?.descriptor.targets).toEqual(['connector'])
    expect(byId.get(BASIC_METHOD_ID)?.descriptor.targets).toEqual(['connector'])
  })

  it('저장소 기본값은 SSO 미설정이라 앱 로그인 게이트를 켜지 않는다', () => {
    // 미설정 상태로 SSO 를 등록하면 채워지지 않은 주소로 로그인 창이 열린다.
    expect(SSO_CONFIG).toBeNull()

    const registry = new AuthRegistry()
    expect(registry.registerMethods(AUTH_METHODS)).toEqual([])
    expect(registry.methodsForTarget('application')).toEqual([])
  })

  it('설정을 채우면 그 방식이 등록되고 앱 로그인 게이트가 켜진다', () => {
    const registry = new AuthRegistry()
    expect(
      registry.registerMethods([createBrowserSessionMethod(SSO_SAMPLE), ...AUTH_METHODS])
    ).toEqual([])

    expect(registry.getMethod('corp-sso')).toBeDefined()
    expect(registry.methodsForTarget('application').map((m) => m.descriptor.id)).toEqual([
      'corp-sso'
    ])
    // 같은 방식으로 서비스 연결도 한다 — 로그인 세션의 cookie jar 를 그대로 쓴다.
    expect(registry.methodsForTarget('connector').map((m) => m.descriptor.id)).toContain('corp-sso')
  })

  it('대상이 SSO 를 acceptedMethods 로 선언하면 교차 참조가 성립한다', () => {
    const registry = new AuthRegistry()
    registry.registerMethods([createBrowserSessionMethod(SSO_SAMPLE), ...AUTH_METHODS])
    expect(
      registry.register({
        connectors: [
          {
            descriptor: {
              id: 'wiki',
              label: '사내 위키',
              acceptedMethods: ['corp-sso', PAT_METHOD_ID],
              baseUrl: 'https://portal.corp.invalid',
              presentation: { location: 'header', name: 'Authorization', scheme: 'Bearer' }
            },
            start: async () => ({ health: 'ready' }),
            invoke: async () => ({ ok: true, data: null }),
            stop: async () => undefined
          }
        ]
      })
    ).toEqual([])
    expect(registry.validateCrossReferences()).toEqual([])
  })

  it('경로가 붙은 origin 은 등록에서 거부된다 — 조용히 전부 막히지 않게', () => {
    const registry = new AuthRegistry()
    const errors = registry.registerMethods([
      createBrowserSessionMethod({
        ...SSO_SAMPLE,
        allowedOrigins: ['https://portal.corp.invalid/app']
      })
    ])
    expect(errors).toHaveLength(1)
    expect(registry.getMethod('corp-sso')).toBeUndefined()
  })

  it('중복 id 는 거부된다 — 로드 순서로 인증 구현이 갈리지 않게', () => {
    const registry = new AuthRegistry()
    expect(registry.registerMethods(AUTH_METHODS)).toEqual([])
    const errors = registry.registerMethods(AUTH_METHODS)
    expect(errors).toHaveLength(AUTH_METHODS.length)
  })
})
