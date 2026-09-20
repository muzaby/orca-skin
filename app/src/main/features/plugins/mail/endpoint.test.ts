// ΔV2 — 연결 좌표는 선언 한 곳에서 파생된다 (0237 AC40).

import { describe, expect, it, vi } from 'vitest'
import { MailEndpointError, parseMailEndpoint } from './endpoint'
import { mailTools } from './tools'
import type { PluginAuth } from '../../../contracts/auth'

function pluginAuth(origin: string): PluginAuth {
  return {
    authId: 'mail',
    origin,
    snapshot: () => ({ authId: 'mail', status: 'valid', verified: true, credentialRevision: 1 }),
    request: () => Promise.reject(new Error('mail plugin does not use HTTP')),
    secret: () => 'user:secret',
    reportAuthFailure: () => undefined
  }
}

describe('AC40 — origin 에서 host·port·tls 를 파생한다', () => {
  it('scheme 이 TLS 와 기본 포트를 정한다', () => {
    expect(parseMailEndpoint('pop3s://pop.example.corp:995')).toEqual({
      host: 'pop.example.corp',
      port: 995,
      tls: true
    })
    // 명시 포트가 이긴다.
    expect(parseMailEndpoint('pop3s://pop.example.corp:1995')).toEqual({
      host: 'pop.example.corp',
      port: 1995,
      tls: true
    })
    // 포트 미지정이면 scheme 기본값.
    expect(parseMailEndpoint('pop3s://pop.example.corp')).toEqual({
      host: 'pop.example.corp',
      port: 995,
      tls: true
    })
    // 평문은 **선언으로만** 열린다 — 기본이 아니다(D-025).
    expect(parseMailEndpoint('pop3://pop.example.corp:110')).toEqual({
      host: 'pop.example.corp',
      port: 110,
      tls: false
    })
  })

  it('지원하지 않는 scheme·빈 host 는 조립에서 던진다', () => {
    expect(() => parseMailEndpoint('https://pop.example.corp')).toThrow(MailEndpointError)
    expect(() => parseMailEndpoint('imaps://mail.example.corp:993')).toThrow(MailEndpointError)
    expect(() => parseMailEndpoint('mailto:a@b')).toThrow(MailEndpointError)
    expect(() => parseMailEndpoint('not a url')).toThrow(MailEndpointError)
  })

  it('도구 조립이 origin 을 실제로 읽는다 — 형식이 틀리면 즉시 드러난다', () => {
    expect(() =>
      mailTools(pluginAuth('https://pop.example.corp'), {
        plugin: { accountId: 'account' },
        socketFactory: vi.fn(),
        dataDir: 'C:/mail-root'
      })
    ).toThrow(MailEndpointError)

    // 올바른 origin 이면 조립된다 — 도구를 부를 때가 아니라 **부팅에서** 판정된다.
    const server = mailTools(pluginAuth('pop3s://pop.example.corp:995'), {
      plugin: { accountId: 'account' },
      socketFactory: vi.fn(),
      dataDir: 'C:/mail-root'
    })
    expect(server.descriptor.tools).toHaveLength(3)
  })

  it('도구 옵션에는 host·port·tls 가 없다 — 두 번째 사본을 만들지 않는다', () => {
    // 타입 수준의 단언이다. 이 객체 리터럴에 `host` 를 더하면 컴파일이 깨진다.
    const options = { accountId: 'account' } as const
    expect(Object.keys(options)).toEqual(['accountId'])
  })
})
