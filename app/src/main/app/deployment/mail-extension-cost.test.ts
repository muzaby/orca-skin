import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AuthDefinition, AuthMethod } from '../../contracts/auth'
import { createAuthRuntime } from '../../features/auth/runtime'
import { createMemoryGrantPersistence } from '../../features/auth/store'
import { createVault } from '../../infra/vault'
import type { MailConnection, MailCredential } from '../../features/plugins/mail/auth'

// 확장 비용 게이트 — **두 지점이 서로를 붙잡는다.**
//
//  (1) 아래 fixture 는 mail 의 확장 인터페이스(`MailCredential`·`MailConnection`)와 *실제* core
//      계약(`AuthDefinition`·`AuthMethod`)으로 IMAP 과 XOAUTH2 를 조립한다. 두 타입을 지우거나
//      형상을 바꾸면 typecheck 가 깨진다 — "인터페이스만 남긴다" 가 주석이 아니라 컴파일이 된다.
//  (2) 그 조립이 core 에 프로토콜·메커니즘 이름을 한 건도 요구하지 않는다. 다음 프로토콜이
//      core 분기를 요구하는 순간 (2) 의 수가 오른다.

// (1) — 미지원 확장을 현재 계약만으로 적을 수 있는가.
const imapConnection: MailConnection = {
  protocol: 'imap',
  host: 'imap.example.corp',
  port: 993,
  tls: true
}

const appPasswordCredential: MailCredential = {
  mechanism: 'app-password',
  username: 'alice',
  password: 'app-pw'
}

const xoauth2Credential: MailCredential = {
  mechanism: 'xoauth2',
  username: 'alice',
  accessToken: 'token'
}

// XOAUTH2 는 core 의 일반 `oauth` 방식으로 적힌다 — 새 `kind` 를 core 에 넣지 않는다.
const xoauth2Method: AuthMethod = {
  kind: 'oauth',
  label: 'XOAUTH2',
  authorize: async () => ({
    url: 'https://idp.example.corp/authorize',
    redirect: { kind: 'manual' },
    exchange: async () => ({ token: xoauth2Credential.accessToken })
  })
}

// 앱 비밀번호도 마찬가지로 일반 `password` 방식이다.
const appPasswordMethod: AuthMethod = {
  kind: 'password',
  label: '앱 비밀번호',
  fields: [
    { name: 'username', label: '아이디', type: 'text', required: true },
    { name: 'password', label: '앱 비밀번호', type: 'password', required: true }
  ],
  compose: (input) => ({
    value: `${input.username}:${input.password}`,
    principalId: input.username
  })
}

// IMAP 은 자기 scheme 을 쓴다 — `mailOrigin` 은 POP3 authoring 이므로 빌려 쓰지 않는다.
const imapDefinition: AuthDefinition = {
  id: 'mail-imap',
  label: 'IMAP 메일',
  origin: `${imapConnection.tls ? 'imaps' : 'imap'}://${imapConnection.host}:${imapConnection.port}`,
  methods: [appPasswordMethod, xoauth2Method]
}

// (2) — core 가 프로토콜·메커니즘 이름을 갖는가. 대상 집합은 **디렉토리에서 읽는다**:
// 손으로 적으면 새 core 파일이 조용히 분모 밖에 남는다.
const CORE_ROOTS = ['src/main/contracts', 'src/main/features/auth']
const PROTOCOL_NAMES = /\b(pop3s?|imaps?|smtps?|xoauth2|app-password)\b/i

function coreProductionFiles(): string[] {
  const found: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.ts') && !entry.name.includes('.test.')) found.push(path)
    }
  }
  for (const root of CORE_ROOTS) walk(root)
  return found
}

describe('extension cost', () => {
  it('registers a new protocol and its methods without touching core', () => {
    expect(imapDefinition.methods.map((method) => method.kind)).toEqual(['password', 'oauth'])
    expect(appPasswordCredential.mechanism).toBe('app-password')
    expect(xoauth2Credential.mechanism).toBe('xoauth2')

    // 선언을 실제 runtime 에 등록한다 — core 가 새 프로토콜을 받아들이는지는 타입이 아니라
    // 여기가 말한다(D-051: non-HTTP authority 등록 허용).
    const secrets = new Map<string, string>()
    const { runtime } = createAuthRuntime({
      definitions: [imapDefinition],
      fetchImpl: async () => new Response('ok'),
      persistence: createMemoryGrantPersistence(),
      vault: createVault({
        get: (key) => secrets.get(key),
        set: (key, value) => void secrets.set(key, value),
        delete: (key) => void secrets.delete(key)
      })
    })
    expect(runtime.bindForPlugin('mail-imap').origin).toBe('imaps://imap.example.corp:993')
  })

  it('costs core zero protocol or mechanism names', () => {
    const files = coreProductionFiles()
    expect(files.length).toBeGreaterThan(5)
    const offenders = files.filter((path) => PROTOCOL_NAMES.test(readFileSync(path, 'utf8')))
    expect(offenders).toEqual([])
  })
})
