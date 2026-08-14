// OAuth code→token 의 **순수부** (0181) — PKCE 생성 · state 발급/보관/대조 · 콜백 URL 파싱.
//
// ── 왜 코어가 갖는가 ─────────────────────────────────────────────────────────
// PKCE 와 `state` 는 provider 마다 달라질 여지가 없는 진짜 공통이다. 각 선언에 맡기면 한 곳만
// 빼먹어도 조용히 취약해진다 — code 가로채기(PKCE 부재)와 CSRF(state 부재)는 둘 다 "동작은
// 하는데 안전하지 않은" 상태라 테스트로도 안 잡힌다. 그래서 배포 선언은 `ctx.pkce()`·
// `ctx.state()` 가 준 값을 authorize URL 에 싣기만 한다.
//
// ── 왜 파일에 보관하는가 (AC4) ───────────────────────────────────────────────
// 루프백 콜백은 **사용자의 브라우저**가 앱 밖에서 완료시킨다. 그 사이 앱이 재시작되면
// (업데이트 설치·크래시·사용자가 껐다 켬) 메모리에 있던 state·verifier 가 사라져 돌아온
// 콜백을 대조할 수 없다. 대조 실패는 곧 로그인 실패이므로, 발급 시점에 파일로 내려 둔다.
//
// electron·http 의존 0 — 이 파일은 전부 vitest 대상이다. 창·리스너는 `oauth-runner.ts`.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { PkcePair } from '../../contracts/auth'

// 발급된 인가 요청 1건. **verifier 는 비밀이지만 vault 에 넣지 않는다** — 수명이 인가 왕복
// (수 분)뿐이고, 유출돼도 code 없이는 토큰이 되지 않는다. 대신 소비 즉시 폐기한다.
export interface PendingAuthorization {
  authId: string
  state: string
  verifier: string
  createdAt: number
  // 루프백에서 authorize 에 실었던 값. 교환 요청이 같은 값을 보내야 한다(RFC 6749 §4.1.3).
  redirectUri?: string
  // authorize 요청에 `state` 를 실었는가. **선언이 `ctx.state()` 를 불렀는지가 그대로 답이다** —
  // 선언이 state 값을 얻을 수 있는 통로가 그것뿐이라, 미호출은 곧 미전송이다(추론이 아니라
  // 필요조건). 안 보냈으면 SP 가 돌려줄 것도 없으므로 콜백 대조를 요구하지 않는다.
  //
  // **`undefined` 는 `true`(대조 요구)로 읽는다** — 이 필드가 없던 시절의 레코드가 조용히
  // 관대해지지 않게 한다.
  stateSent?: boolean
}

export interface OAuthStatePersistencePort {
  load(): Record<string, PendingAuthorization>
  save(records: Record<string, PendingAuthorization>): void
}

export function createMemoryOAuthStatePersistence(
  seed: Record<string, PendingAuthorization> = {}
): OAuthStatePersistencePort {
  let records = { ...seed }
  return {
    load: () => ({ ...records }),
    save: (next) => {
      records = { ...next }
    }
  }
}

// 인가 왕복의 상한. 이보다 오래된 pending 은 사용자가 창을 닫고 잊은 것이라 정리한다.
export const AUTHORIZATION_TTL_MS = 10 * 60 * 1000

// RFC 7636 §4.1 — verifier 는 43~128자의 unreserved 문자열. 32바이트 base64url = 43자.
export function base64Url(bytes: Buffer): string {
  return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// RFC 7636 §4.2 — challenge = BASE64URL(SHA256(ASCII(verifier))). **plain 은 지원하지 않는다**:
// 다운그레이드 선택지를 두면 언젠가 그것이 기본값이 된다.
export function challengeFor(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier, 'ascii').digest())
}

export function createPkce(random: (size: number) => Buffer = randomBytes): PkcePair {
  const verifier = base64Url(random(32))
  return { verifier, challenge: challengeFor(verifier), method: 'S256' }
}

export function createState(random: (size: number) => Buffer = randomBytes): string {
  return base64Url(random(32))
}

// 길이가 다르면 timingSafeEqual 이 던지므로 먼저 거른다. 짧은 비교라 타이밍 이득은 작지만,
// 비교 방식이 곧 규약이라 대조 지점을 한 곳으로 모은다.
export function statesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(received, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export type CallbackParse =
  | { kind: 'code'; code: string; state: string | null }
  // 인가 서버가 명시적으로 거부했다(`error=access_denied` 등).
  | { kind: 'error'; error: string; description?: string }
  | { kind: 'unrelated' }

// 콜백 URL 에서 code·state 를 뽑는다. **query 와 fragment 를 모두 본다** — 일부 서버가
// `response_mode=fragment` 로 돌려준다.
export function parseCallbackUrl(rawUrl: string): CallbackParse {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { kind: 'unrelated' }
  }
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''))
  const pick = (name: string): string | null => url.searchParams.get(name) ?? fragment.get(name)

  const error = pick('error')
  if (error !== null) {
    const description = pick('error_description')
    return { kind: 'error', error, ...(description !== null ? { description } : {}) }
  }
  const code = pick('code')
  if (code === null) return { kind: 'unrelated' }
  return { kind: 'code', code, state: pick('state') }
}

// state → pending 의 **1회용** 원장. 발급 즉시 영속되고, 소비하면 사라진다.
export class OAuthStateStore {
  constructor(
    private readonly persistence: OAuthStatePersistencePort,
    private readonly clock: () => number = Date.now
  ) {}

  issue(pending: Omit<PendingAuthorization, 'createdAt'>): PendingAuthorization {
    const records = this.prune()
    const record: PendingAuthorization = { ...pending, createdAt: this.clock() }
    // provider 당 진행 중 인가는 1건이다 — 새로 시작하면 이전 것은 버린다(조용한 누적 방지).
    for (const [state, existing] of Object.entries(records)) {
      if (existing.authId === record.authId) delete records[state]
    }
    records[record.state] = record
    this.persistence.save(records)
    return record
  }

  // 콜백 대조. `state` 가 없으면(manual 분기) authId 로 찾는다 — 그 경우 CSRF 방어는
  // "사용자가 방금 이 provider 의 인증을 시작했다" 는 사실 자체가 담당한다.
  consume(match: { state?: string | null; authId: string }): PendingAuthorization | null {
    const records = this.prune()
    const found = match.state
      ? Object.values(records).find(
          (record) => record.authId === match.authId && statesMatch(record.state, match.state ?? '')
        )
      : Object.values(records).find((record) => record.authId === match.authId)
    if (!found) return null
    delete records[found.state]
    this.persistence.save(records)
    return found
  }

  // 진행 중인지만 본다(대조·소비 없음).
  pendingFor(authId: string): PendingAuthorization | null {
    return Object.values(this.prune()).find((record) => record.authId === authId) ?? null
  }

  private prune(): Record<string, PendingAuthorization> {
    const now = this.clock()
    const records = this.persistence.load()
    let changed = false
    for (const [state, record] of Object.entries(records)) {
      if (now - record.createdAt > AUTHORIZATION_TTL_MS) {
        delete records[state]
        changed = true
      }
    }
    if (changed) this.persistence.save(records)
    return records
  }
}
