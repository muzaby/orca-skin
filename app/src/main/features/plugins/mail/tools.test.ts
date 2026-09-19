// Mail 도구 계층 — **DB 도 소켓도 열지 않는다.**
//
// `createMailToolServer(auth, manager)` 가 그 seam 이다(0237 ΔV2 — MD-09/AC38). confluence 의
// `createConfluenceToolServer(auth, runtime)`·jira 의 `createJiraToolServer(auth, service)` 와
// 같은 형상이라, 세 Plugin 의 도구 계층을 같은 방식으로 검증한다.

import { describe, expect, it, vi } from 'vitest'
import { createMailToolServer, mailTools, type MailToolManagerPort } from './tools'
import { authToolServerId } from '../../../adapters/runtime-tool-policy'
import type { PluginAuth } from '../../../contracts/auth'

const auth = (authId = 'mail'): PluginAuth => ({
  authId,
  label: '사내 메일',
  origin: 'https://mail.example.corp',
  snapshot: () => ({ authId, status: 'valid', verified: true, credentialRevision: 1 }),
  request: async () => {
    throw new Error('mail Plugin 은 HTTP 를 쓰지 않는다')
  }
})

const manager = (overrides: Partial<MailToolManagerPort> = {}): MailToolManagerPort => ({
  sync: async () => ({ synced: false, fresh: true, lastSyncAt: null }),
  search: () => ({ cacheAsOf: null, stale: false, total: 0, results: [] }),
  getAttachment: async () => null,
  ...overrides
})

describe('mail tool surface', () => {
  // AC22 회귀 — 조립 시그니처가 바뀌어도 descriptor 3자리는 글자 그대로다(D-028).
  it('exposes exactly three tools with search as the only read-only operation', () => {
    const server = createMailToolServer(auth(), async () => manager())
    expect(server.descriptor.id).toBe(authToolServerId('mail'))
    expect(server.descriptor.connectorId).toBe('mail')
    expect(server.descriptor.tools.map((tool) => tool.name)).toEqual([
      'mail_sync',
      'mail_search',
      'mail_getAttachment'
    ])
    expect(server.descriptor.tools.map((tool) => tool.annotations?.readOnlyHint)).toEqual([
      false,
      true,
      false
    ])
    expect(server.descriptor.instructions).toContain('attachmentId')
  })

  it('requires both attachment identifiers in the public schema', () => {
    const server = createMailToolServer(auth(), async () => manager())
    const tool = server.implementations.find((item) => item.name === 'mail_getAttachment')
    expect(tool?.inputSchema).toEqual({
      mailId: expect.anything(),
      attachmentId: expect.anything()
    })
  })

  // AC38 — 주입한 manager 의 반환이 그대로 결과에 실린다. DB·소켓 없이 도구 계층만 돈다.
  it('주입된 manager 의 반환을 결과에 그대로 싣는다', async () => {
    const hit = { cacheAsOf: 42, stale: true, total: 1, results: [{ mailId: 'm1' }] }
    const search = vi.fn(() => hit)
    const server = createMailToolServer(auth(), async () => manager({ search }))
    const tool = server.implementations.find((item) => item.name === 'mail_search')

    const result = await tool!.handler({ query: '회의', limit: 5 }, undefined)

    expect(search).toHaveBeenCalledWith('회의', 5)
    expect(result.structuredContent).toEqual(hit)
    expect(result.isError).toBeUndefined()
  })

  // 결함 변이: manager 를 무시하고 도구 계층이 자기 값을 만들면 위 단언이 red 가 된다.
  it('manager 가 던지면 공개 오류 코드로 접는다 — 내부 경로는 새지 않는다', async () => {
    const server = createMailToolServer(auth(), async () =>
      manager({
        search: () => {
          throw new Error('C:/Users/me/AppData/orca/mail.db 잠김')
        }
      })
    )
    const tool = server.implementations.find((item) => item.name === 'mail_search')

    const result = await tool!.handler({ query: 'x' }, undefined)

    expect(result.isError).toBe(true)
    expect(JSON.stringify(result)).not.toContain('mail.db')
  })

  // AC35 양성 — 상위 조립부가 auth 포트 하나 + 전송 한 벌 + 옵션으로 조립된다.
  it('mailTools 는 PluginAuth 와 전송 한 벌로 조립된다', () => {
    const socketFactory = vi.fn()
    const server = mailTools(
      auth('mail-corp'),
      {
        credential: () => ({ kind: 'password' as const, username: 'u', password: 'secret' }),
        root: 'C:/mail-root',
        socketFactory
      },
      { accountId: 'account', host: 'pop.example.test' }
    )

    expect(server.descriptor.connectorId).toBe('mail-corp')
    expect(server.descriptor.tools).toHaveLength(3)
    // 조립만으로는 소켓을 열지 않는다 — manager 는 첫 호출에서 lazy 로 만들어진다.
    expect(socketFactory).not.toHaveBeenCalled()
  })
})
