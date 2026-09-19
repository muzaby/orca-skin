// 프로토콜 경계 (0237 ΔV3 — AC42·AC43·AC44 / VP-32·VP-33 / EP-25·EP-26).
//
// **음성 스윕만 두면 배선을 통째로 지워도 초록이다.** 그래서 "`sync-manager` 가 `pop3/` 를
// import 하지 않는다"(음성)에 "**POP3 가 아닌** 세션으로 sync 가 끝까지 돈다"(양성)를 짝지었다.

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMailSyncManager } from './sync-manager'
import { MailError, normalizeMailError } from './errors'
import type { MailReadSession, MailReadSessionFactory } from './transport'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const SOURCE = new URL('./sync-manager.ts', import.meta.url).pathname

// POP3 가 아닌 가상 프로토콜. 소켓도 `CAPA` 도 없다 — 포트 4메서드만 만족한다.
function fakeProtocol(messages: readonly { uid: string; date: string; body: string }[]): {
  factory: MailReadSessionFactory
  closed: string[]
} {
  const closed: string[] = []
  const session: MailReadSession = {
    capabilities: async () => ['IMAGINARY'],
    login: async () => undefined,
    list: async () => messages.map((item, index) => ({ uid: item.uid, ordinal: index + 1 })),
    header: async (ref) => `Date: ${messages[ref.ordinal - 1]!.date}\r\nSubject: 제목`,
    body: async (ref) => {
      const item = messages[ref.ordinal - 1]!
      return Buffer.from(
        `Date: ${item.date}\r\nFrom: a@b.c\r\nTo: d@e.f\r\nSubject: 제목\r\n\r\n${item.body}\r\n`,
        'utf8'
      )
    },
    close: async (kind) => void closed.push(kind)
  }
  return { factory: () => session, closed }
}

async function manager(
  factory: MailReadSessionFactory,
  now: number
): ReturnType<typeof createMailSyncManager> {
  const root = await mkdtemp(join(tmpdir(), 'orca-mail-boundary-'))
  roots.push(root)
  return createMailSyncManager({
    authId: 'mail-corp',
    credential: () => ({ kind: 'password', username: 'u', password: 'p' }),
    options: { accountId: 'mail-corp', host: 'pop.example.corp' },
    sessionFactory: factory,
    socketFactory: vi.fn(),
    root,
    now: () => now
  })
}

describe('sync-manager 는 프로토콜을 모른다 (AC42 / EP-25)', () => {
  it('음성 — 소스에 pop3/ import 가 0건이다', async () => {
    const source = await readFile(SOURCE, 'utf8')

    const imports = source
      .split('\n')
      .filter((line) => /^\s*import\b/.test(line) && line.includes('pop3'))

    expect(imports).toEqual([])
  })

  it('양성 — POP3 가 아닌 세션으로 sync 가 끝까지 돈다', async () => {
    const now = Date.UTC(2026, 8, 18, 0, 0, 0)
    const protocol = fakeProtocol([
      { uid: 'imaginary-1', date: new Date(now - 1000).toUTCString(), body: '회의 일정입니다' }
    ])
    const mail = await manager(protocol.factory, now)

    const result = await mail.sync()

    expect(result).toMatchObject({ synced: true, newMails: 1 })
    expect(mail.search('회의').total).toBe(1)
    // 정상 종료는 프로토콜 종료 명령으로 닫는다.
    expect(protocol.closed).toEqual(['graceful'])
    mail.close()
  })

  it('양성 — 소켓 팩토리는 주입만 되고 호출되지 않는다', async () => {
    const socketFactory = vi.fn()
    const now = Date.UTC(2026, 8, 18, 0, 0, 0)
    const protocol = fakeProtocol([])
    const root = await mkdtemp(join(tmpdir(), 'orca-mail-boundary-'))
    roots.push(root)
    const mail = await createMailSyncManager({
      authId: 'mail-corp',
      credential: () => ({ kind: 'password', username: 'u', password: 'p' }),
      options: { accountId: 'mail-corp', host: 'pop.example.corp' },
      sessionFactory: protocol.factory,
      socketFactory,
      root,
      now: () => now
    })

    await mail.sync()

    // 세션 구현이 쓰지 않으면 소켓은 열리지 않는다 — factory 가 프로토콜의 것이라는 증거다.
    expect(socketFactory).not.toHaveBeenCalled()
    mail.close()
  })
})

describe('오류 taxonomy 는 프로토콜 무관 층이다 (AC43 / D-057)', () => {
  it('프로토콜 모듈을 거치지 않고 같은 코드로 접힌다', async () => {
    const now = Date.UTC(2026, 8, 18, 0, 0, 0)
    const failing: MailReadSessionFactory = () => ({
      capabilities: async () => [],
      login: async () => {
        throw new MailError('timeout')
      },
      list: async () => [],
      header: async () => '',
      body: async () => new Uint8Array(),
      close: async () => undefined
    })
    const mail = await manager(failing, now)

    const result = await mail.sync()

    expect(result).toMatchObject({ synced: false, error: 'timeout', stale: true })
    mail.close()
  })

  it('정규화는 MailError 를 돌려준다 — 이름에 프로토콜이 없다', () => {
    expect(normalizeMailError(new Error('socket hang up')).code).toBe('connection_failed')
    expect(normalizeMailError(new Error('x')).name).toBe('MailError')
  })
})

describe('스키마가 프로토콜 중립이다 (AC44 / EP-26)', () => {
  it('중립 식별자만 쓰고 POP3 어휘는 0건이다', async () => {
    const sql = await readFile(
      new URL('./migrations/0001_mail.sql', import.meta.url).pathname,
      'utf8'
    )

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS message_ledger')
    expect(sql).toContain('remote_uid')
    // `ordinal` 은 nullable 이다 — IMAP sequence number 는 세션 밖에서 유효하지 않다.
    expect(sql).toMatch(/ordinal INTEGER(?!\s+NOT NULL)/)
    expect(sql).not.toMatch(/\buidl\b/)
    expect(sql).not.toMatch(/\bmessage_number\b/)
  })
})
