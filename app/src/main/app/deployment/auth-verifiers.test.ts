// 연결 버튼의 실제 왕복 증명 (0237 ΔV3 — AC29′ / VP-35 / EP-17).
//
// **구 AC29 는 실패 축만 봤다** — `-ERR` 이면 커밋하지 않는다까지만 단언하고 **무엇이
// 전송됐는지**를 묻지 않았다. 그래서 G4(합성 문자열을 통째로 `PASS` 로 전송)가 게이트를
// 통과했다. 여기서는 성공 축을 함께 닫고 수신 명령을 인자까지 대조한다.

import { describe, expect, it, vi } from 'vitest'
import { createPop3CandidateVerifier } from './auth-verifiers'
import { createFakePop3Server } from '../../features/plugins/mail/pop3/fake-server.testfixture'
import type { Grant } from '../../contracts/auth'
import type { MailReadSessionFactory } from '../../features/plugins/mail/transport'

const connection = { host: 'pop.example.corp', port: 995, tls: true }

const grant = (principalId?: string): Grant => ({
  kind: 'secret',
  vaultKey: 'provider:mail-corp:password@1',
  authKind: 'password',
  createdAt: 1_000,
  ...(principalId ? { principalId } : {})
})

describe('POP3 후보 검증 (AC29′)', () => {
  it('맞는 값이면 연결되고 USER·PASS 가 각각 정확히 나간다', async () => {
    const server = createFakePop3Server({ user: 'alice@corp', password: 'hunter2' })
    const verify = createPop3CandidateVerifier({ connection, socketFactory: server.factory })

    const result = await verify('mail-corp', {
      grant: grant('alice@corp'),
      secret: 'alice@corp:hunter2'
    })

    expect(result).toEqual({ ok: true, rejected: false })
    expect(server.received).toContain('USER alice@corp')
    expect(server.received).toContain('PASS hunter2')
    // **G4 회귀** — 합성형이 전송되면 red 다.
    expect(server.received.join('\n')).not.toContain('alice@corp:hunter2')
  })

  it('틀린 비밀번호는 거부로 분류된다 — 값을 고쳐야 하는 실패', async () => {
    const server = createFakePop3Server({ user: 'alice@corp', password: 'hunter2' })
    const verify = createPop3CandidateVerifier({ connection, socketFactory: server.factory })

    const result = await verify('mail-corp', {
      grant: grant('alice@corp'),
      secret: 'alice@corp:wrong'
    })

    expect(result).toEqual({ ok: false, rejected: true })
  })

  it('도달 실패는 거부가 아니다 — 환경을 고쳐야 하는 실패 (D-041)', async () => {
    const server = createFakePop3Server({ user: 'u', password: 'p', unreachable: true })
    const verify = createPop3CandidateVerifier({ connection, socketFactory: server.factory })

    const result = await verify('mail-corp', { grant: grant('u'), secret: 'u:p' })

    expect(result).toEqual({ ok: false, rejected: false })
  })

  it('검증 전용 로그인 경로를 만들지 않는다 — read 와 같은 세션 factory 를 탄다', async () => {
    const sessionFactory = vi.fn<MailReadSessionFactory>(() => ({
      capabilities: async () => [],
      login: async () => undefined,
      list: async () => [],
      header: async () => '',
      body: async () => new Uint8Array(),
      close: async () => undefined
    }))
    const verify = createPop3CandidateVerifier({
      connection,
      socketFactory: vi.fn(),
      sessionFactory
    })

    await verify('mail-corp', { grant: grant('u'), secret: 'u:p' })

    // 주입된 factory 가 실제로 쓰였고, **선언이 편 형태**로 자격증명이 전달된다.
    expect(sessionFactory).toHaveBeenCalledTimes(1)
    expect(sessionFactory.mock.calls[0]![0]).toMatchObject({
      credential: { kind: 'password', username: 'u', password: 'p' }
    })
  })
})
