// ΔV2 — 새 프로토콜·인증방식의 확장 비용 (0237 AC44 · R-08·R-09 / AT-22).
//
// **주장은 좁다.** 이 파일은 IMAP 이 동작한다고 말하지 않는다 — D-059 가 런타임 구현을 범위
// 밖으로 뒀다. 여기서 재는 것은 두 가지뿐이다:
//
//   ① 새 프로토콜 선언과 새 인증 방식이 **현재 계약 타입으로 컴파일된다**(아래 fixture).
//   ② 그것을 통과시키려고 core 를 넓히지 않았다 — core 파일에 프로토콜 이름이 0건이다.
//
// **두 지점이 서로를 붙잡는다.** ①만 있으면 core 타입을 넓혀서 통과시킬 수 있고, ②만 있으면
// 타입을 지워도 참이다. typecheck 는 ②의 회귀에 초록으로 침묵하므로 지점을 갈라 두었다.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stripCommentsAndStrings } from '../../infra/source-scan'
import { registerAuthDefinitions } from '../../features/auth/registry'
import { passwordSpec } from '../../features/auth/specs/credential'
import type { AuthDefinition, AuthMethod, AuthVerifier } from '../../contracts/auth'

const MAIN_ROOT = join(__dirname, '..', '..')

// ── ① 확장 fixture — **타입만**. 전송·런타임 구현은 만들지 않는다 (D-059) ──────
//
// IMAP: endpoint scheme 이 다를 뿐 선언 형상은 POP3 와 같다.
const imapVerifier: AuthVerifier = async () => ({ ok: false, rejected: false })

const IMAP_AUTH = {
  id: 'corp-imap',
  label: '사내 메일 (IMAP)',
  origin: 'imaps://mail.example.corp:993',
  methods: [{ ...passwordSpec({ label: 'ID/비밀번호' }), verify: imapVerifier }]
} satisfies AuthDefinition

// app password: `password` 갈래 그대로다 — `AuthMethodKind` 에 갈래를 더하지 않는다.
const APP_PASSWORD_METHOD: AuthMethod = {
  ...passwordSpec({ label: '앱 비밀번호' }),
  verify: async () => ({ ok: true })
}

// XOAUTH2: 기존 `oauth` 갈래가 `verify` 를 구현한 것이다. 토큰 흐름은 선언이 소유한다.
const XOAUTH2_METHOD: AuthMethod = {
  kind: 'oauth',
  label: 'XOAUTH2',
  present: { location: 'header', name: 'Authorization', scheme: 'bearer' },
  authorize: async () => ({
    url: 'https://idp.example.corp/authorize',
    redirect: { kind: 'manual' },
    exchange: async () => ({ token: 'access' })
  }),
  verify: async () => ({ ok: true })
}

describe('AC44 — 새 프로토콜·인증방식은 선언으로 들어온다', () => {
  it('① IMAP 선언이 현재 계약으로 등록된다', () => {
    const result = registerAuthDefinitions([IMAP_AUTH])
    expect(result.rejected).toEqual([])
    expect(result.definitions[0].origin).toBe('imaps://mail.example.corp:993')
  })

  it('① app password·XOAUTH2 가 기존 갈래를 재사용한다 — AuthMethodKind 가 늘지 않는다', () => {
    expect(APP_PASSWORD_METHOD.kind).toBe('password')
    expect(XOAUTH2_METHOD.kind).toBe('oauth')
    // 두 방식 모두 자기 확인을 들고 있다 — core 는 부를 자리 하나만 갖는다.
    expect(typeof APP_PASSWORD_METHOD.verify).toBe('function')
    expect(typeof XOAUTH2_METHOD.verify).toBe('function')
    // **원문의 `AuthMethodShape` 블록만 읽는다** — `kind` 값은 문자열 리터럴이라
    // `stripCommentsAndStrings` 가 지우고, 파일 전체를 세면 `Grant`·`AuthChange`·
    // `OAuthRedirect` 의 갈래까지 섞인다(주어가 흐려진다).
    const source = readFileSync(join(MAIN_ROOT, 'contracts/auth.ts'), 'utf8')
    const start = source.indexOf('type AuthMethodShape =')
    const block = source.slice(start, source.indexOf('export type AuthMethodKind', start))
    expect(start).toBeGreaterThan(0)
    const kinds = [...new Set(block.match(/kind: '[a-z-]+'/g))].sort()
    expect(kinds).toEqual([
      "kind: 'api-key'",
      "kind: 'browser-session'",
      "kind: 'oauth'",
      "kind: 'password'",
      "kind: 'pat'"
    ])
  })

  it('② core 파일 어디에도 프로토콜 이름이 없다', () => {
    // 이 fixture 를 통과시키는 가장 쉬운 길은 core 타입을 프로토콜별로 넓히는 것이다.
    // 그 순간 아래가 red 가 된다 — typecheck 는 그 회귀에 침묵한다.
    const coreFiles = [
      'contracts/auth.ts',
      'features/auth/registry.ts',
      'features/auth/login.ts',
      'features/auth/runtime.ts',
      'features/auth/authenticated-request.ts',
      'features/auth/specs/credential.ts',
      'app/bootstrap.ts'
    ]
    for (const file of coreFiles) {
      const source = stripCommentsAndStrings(readFileSync(join(MAIN_ROOT, file), 'utf8'))
      for (const protocol of ['pop3', 'imap', 'smtp', 'xoauth2']) {
        expect({ file, protocol, hit: new RegExp(protocol, 'i').test(source) }).toEqual({
          file,
          protocol,
          hit: false
        })
      }
    }
  })

  it('② 프로토콜 지식은 플러그인 슬라이스에 있다 (양성 대조)', () => {
    // 위 음성이 "아무 데도 없다" 로 읽히지 않도록 짝짓는다 — 지식은 사라진 것이 아니라
    // 옮겨졌다.
    const verifier = readFileSync(join(MAIN_ROOT, 'features/plugins/mail/auth.ts'), 'utf8')
    expect(verifier).toContain('createPop3Session')
    const endpoint = readFileSync(join(MAIN_ROOT, 'features/plugins/mail/endpoint.ts'), 'utf8')
    expect(endpoint).toContain("'pop3s:'")
  })
})
