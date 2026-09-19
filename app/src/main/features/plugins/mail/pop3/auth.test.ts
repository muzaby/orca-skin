// 자격증명 언폴딩과 메커니즘 선택 (0237 ΔV3 — AC40·AC41·AC45 / VP-31·VP-34 / EP-24·EP-15).
//
// **G4 가 이 파일의 존재 이유다.** 구 구현은 vault 합성값(`user:pass`)을 통째로 `PASS` 로
// 보내고 아이디는 정적 설정값에서 가져왔다. 수신 로그를 인자까지 단언하는 것이 판별자다 —
// "로그인이 성공했다" 는 서버가 받아 주기만 하면 참이 된다.

import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { stripCommentsAndStrings } from '../../../../infra/source-scan'
import { createPop3Session, READ_ONLY_COMMANDS } from './session'
import { selectAuthenticator, POP3_AUTHENTICATORS } from './auth'
import { createFakePop3Server } from './fake-server.testfixture'
import { MailError } from '../errors'
import type { CredentialMaterial } from '../../../../contracts/auth'

const connection = { host: 'pop.example.corp', port: 995, tls: true }

// **언폴딩 자체는 auth 슬라이스가 시험한다** (`features/auth/specs/credential.test.ts`) —
// mail 이 그 함수를 부르면 feature 교차 import 라 lint error 다. 그 경계가 곧 "파싱 규칙은
// 선언이 소유한다"(D-054)의 강제 지점이다. 여기서는 **편 형태를 받았을 때** 무엇이 나가는지만
// 본다. vault 문자열 → 명령까지의 종단 왕복은 `app/deployment/auth-verifiers.test.ts` 가 닫는다.
describe('편 자격증명이 프로토콜 인자로 나간다 (AC40 / G4)', () => {
  it('아이디는 USER 로, 비밀번호는 PASS 로 각각 나간다', async () => {
    const server = createFakePop3Server({ user: 'alice@corp', password: 'pw:with:colons' })
    const credential: CredentialMaterial = {
      kind: 'password',
      username: 'alice@corp',
      password: 'pw:with:colons'
    }

    const session = createPop3Session({ ...connection, credential }, server.factory)
    await session.login()

    expect(server.received).toContain('USER alice@corp')
    expect(server.received).toContain('PASS pw:with:colons')
    // 음성 — 합성형이 어느 명령에도 실리지 않는다. **구 구현이 red 가 되는 지점이다.**
    expect(server.received.join('\n')).not.toContain('alice@corp:pw')
  })
})

describe('메커니즘 선택 (AC41 / D-055)', () => {
  it('등록된 구현체는 USERPASS 1종이다 — XOAUTH2 는 홀드다 (D-039)', () => {
    expect(POP3_AUTHENTICATORS.map((item) => item.mechanism)).toEqual(['USERPASS'])
  })

  it('password material 은 광고 없이도 USERPASS 를 고른다', () => {
    const credential: CredentialMaterial = { kind: 'password', username: 'u', password: 'p' }
    expect(selectAuthenticator(credential, []).mechanism).toBe('USERPASS')
  })

  it('token material 은 광고가 없으면 실패한다 — 평문 폴백 금지', () => {
    const credential: CredentialMaterial = { kind: 'token', username: 'u', accessToken: 't' }
    expect(() => selectAuthenticator(credential, ['UIDL', 'TOP'])).toThrow(MailError)
    expect(() => selectAuthenticator(credential, ['UIDL', 'TOP'])).toThrow('no_mechanism_for_token')
  })

  it('opaque material 은 POP3 에서 쓸 수 없다', () => {
    const credential: CredentialMaterial = { kind: 'opaque', value: 'x' }
    expect(() => selectAuthenticator(credential, [])).toThrow('no_mechanism_for_opaque')
  })

  it('token 을 PASS 로 흘려보내는 경로가 없다 — 액세스 토큰 평문 전송 방지', async () => {
    const server = createFakePop3Server({ user: 'u', password: 't' })
    const session = createPop3Session(
      { ...connection, credential: { kind: 'token', username: 'u', accessToken: 't' } },
      server.factory
    )

    await expect(session.login()).rejects.toThrow('no_mechanism_for_token')

    expect(server.commands).not.toContain('PASS')
  })
})

describe('read-only 명령 게이트 (AC45 / D-059 · D-031)', () => {
  it('DELE 는 집합에 없다', () => {
    expect(READ_ONLY_COMMANDS.has('DELE')).toBe(false)
  })

  it('개명이 끝났다 — 코드에 READ_ONLY_COMMANDS 식별자가 0건이다', async () => {
    const source = await readFile(new URL('./session.ts', import.meta.url).pathname, 'utf8')

    // **주석은 세지 않는다** — 구 이름을 근거로 남기는 것은 허용이고, 코드가 쓰면 개명이 안 된 것이다.
    const code = stripCommentsAndStrings(source)

    expect(code).not.toContain('READ_ONLY_COMMANDS')
    expect(code).toContain('READ_ONLY_COMMANDS')
  })

  it('허용 9명령이 실제로 전송된다', async () => {
    const server = createFakePop3Server({
      user: 'u',
      password: 'p',
      mailboxes: [{ uid: 'uid-1', headers: 'Date: Mon, 1 Sep 2026 10:00:00 +0900', body: '본문' }]
    })
    const session = createPop3Session(
      { ...connection, credential: { kind: 'password', username: 'u', password: 'p' } },
      server.factory
    )

    await session.login()
    const refs = await session.list()
    await session.header(refs[0]!)
    await session.body(refs[0]!)
    await session.close('graceful')

    // `AUTH` 는 이번 구현체(USERPASS)가 쓰지 않으므로 전송되지 않는다 — 게이트에만 있다.
    expect(new Set(server.commands)).toEqual(
      new Set(['CAPA', 'USER', 'PASS', 'UIDL', 'TOP', 'RETR', 'QUIT'])
    )
    expect(READ_ONLY_COMMANDS.has('AUTH')).toBe(true)
    expect(refs).toEqual([{ ordinal: 1, uid: 'uid-1' }])
  })
})
