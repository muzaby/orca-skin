import { describe, expect, it } from 'vitest'
import type { AuthSpec, Provider } from '../../contracts/auth'
import {
  registerDeclaredSessions,
  sessionPolicies,
  type SessionGroupPolicy
} from './session-policies'
import { registerProviders } from './registry'

function sessionSpec(config: {
  sessionGroup: string
  allowedOrigins: readonly string[]
}): AuthSpec {
  return {
    kind: 'browser-session',
    label: '통합 인증',
    config: {
      sessionGroup: config.sessionGroup,
      loginUrl: 'https://idp.example.corp/login',
      doneUrlPrefix: 'https://portal.example.corp/home',
      allowedOrigins: config.allowedOrigins
    }
  }
}

function provider(over: Partial<Provider> & Pick<Provider, 'id' | 'auth'>): Provider {
  return {
    label: over.id,
    kind: 'gate',
    origin: 'https://portal.example.corp',
    // 게이트는 probe 선언이 없으면 등록 자체가 거부된다(`registry.ts` missing_probe).
    probe: { path: '/api/me' },
    ...over
  } as Provider
}

// 호출 인자를 그대로 모으는 fake — 부팅이 *실제로* 등록하는지를 사람 실기 없이 단언한다.
function fakeSink(): { calls: SessionGroupPolicy[]; register(p: SessionGroupPolicy): void } {
  const calls: SessionGroupPolicy[] = []
  return { calls, register: (p) => void calls.push(p) }
}

describe('sessionPolicies', () => {
  it('browser-session 선언만 뽑는다', () => {
    const providers = [
      provider({
        id: 'corp-sso',
        auth: [
          sessionSpec({ sessionGroup: 'corp', allowedOrigins: ['https://portal.example.corp'] })
        ]
      }),
      provider({
        id: 'wiki',
        kind: 'service',
        auth: [
          {
            kind: 'pat',
            label: 'PAT',
            fields: [{ name: 'secret', label: 'PAT', type: 'password', required: true }],
            present: { location: 'header', name: 'Authorization', scheme: 'bearer' },
            compose: (input) => ({ value: input.secret ?? '' })
          }
        ]
      })
    ]
    expect(sessionPolicies(providers)).toEqual([
      { sessionGroup: 'corp', allowedOrigins: ['https://portal.example.corp'] }
    ])
  })

  it('선언이 없으면 빈 배열이다', () => {
    expect(sessionPolicies([])).toEqual([])
  })
})

describe('registerDeclaredSessions', () => {
  it('선언된 세션 group 을 로그인 없이 등록한다', () => {
    const sink = fakeSink()
    registerDeclaredSessions(sink, [
      provider({
        id: 'corp-sso',
        auth: [
          sessionSpec({
            sessionGroup: 'corp',
            allowedOrigins: ['https://idp.example.corp', 'https://portal.example.corp']
          })
        ]
      })
    ])

    expect(sink.calls).toHaveLength(1)
    expect(sink.calls[0]).toEqual({
      sessionGroup: 'corp',
      allowedOrigins: ['https://idp.example.corp', 'https://portal.example.corp']
    })
  })

  it('같은 group 을 두 provider 가 선언하면 둘 다 등록에 흘려 store 의 합집합 규칙을 태운다', () => {
    const sink = fakeSink()
    registerDeclaredSessions(sink, [
      provider({
        id: 'corp-sso',
        auth: [
          sessionSpec({ sessionGroup: 'corp', allowedOrigins: ['https://portal.example.corp'] })
        ]
      }),
      provider({
        id: 'wiki',
        kind: 'service',
        origin: 'https://wiki.example.corp',
        auth: [sessionSpec({ sessionGroup: 'corp', allowedOrigins: ['https://wiki.example.corp'] })]
      })
    ])

    expect(sink.calls.map((c) => c.sessionGroup)).toEqual(['corp', 'corp'])
    expect(sink.calls.flatMap((c) => [...c.allowedOrigins])).toEqual([
      'https://portal.example.corp',
      'https://wiki.example.corp'
    ])
  })

  it('등록 검사에서 거부된 선언의 group 은 등록하지 않는다', () => {
    // `origin` 에 경로가 붙어 거부되는 선언 — 컴포지션 루트는 `registry.list()`(= 통과한 것)만 넘긴다.
    const declared = [
      provider({
        id: 'bad',
        origin: 'https://portal.example.corp/app',
        auth: [
          sessionSpec({
            sessionGroup: 'bad-group',
            allowedOrigins: ['https://portal.example.corp']
          })
        ]
      }),
      provider({
        id: 'corp-sso',
        auth: [
          sessionSpec({ sessionGroup: 'corp', allowedOrigins: ['https://portal.example.corp'] })
        ]
      })
    ]
    const result = registerProviders(declared)
    expect(result.rejected.map((r) => r.id)).toEqual(['bad'])

    const sink = fakeSink()
    registerDeclaredSessions(sink, result.providers)
    expect(sink.calls.map((c) => c.sessionGroup)).toEqual(['corp'])
  })

  it('등록이 던져도 부팅을 막지 않고 나머지를 계속 등록한다', () => {
    const seen: string[] = []
    const events: string[] = []
    const sink = {
      register(policy: SessionGroupPolicy): void {
        if (policy.sessionGroup === 'boom') throw new Error('partition 생성 실패')
        seen.push(policy.sessionGroup)
      }
    }

    expect(() =>
      registerDeclaredSessions(
        sink,
        [
          provider({
            id: 'a',
            auth: [
              sessionSpec({ sessionGroup: 'boom', allowedOrigins: ['https://portal.example.corp'] })
            ]
          }),
          provider({
            id: 'b',
            auth: [
              sessionSpec({ sessionGroup: 'corp', allowedOrigins: ['https://portal.example.corp'] })
            ]
          })
        ],
        (event) => void events.push(event)
      )
    ).not.toThrow()

    expect(seen).toEqual(['corp'])
    expect(events).toEqual(['providers.session.register.failed'])
  })
})
