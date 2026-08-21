import { describe, expect, it } from 'vitest'
import type { AuthId } from '../../contracts/auth'
import { createVault } from '../../infra/vault'
import type { SecretStorePort } from '../../infra/config/secret-store-port'
import { AuthStore, createMemoryGrantPersistence } from './store'
import {
  isAuthoritative,
  parseGrantRecords,
  parsePendingRecords,
  type ParsedRecordMap
} from './store-parse'

function fakeSecretStore(): SecretStorePort {
  const map = new Map<string, string>()
  return {
    get: (key) => map.get(key),
    set: (key, value) => void map.set(key, value),
    delete: (key) => void map.delete(key)
  }
}

// 이 파일이 존재하는 이유 (r10):
//
// r9 는 `authoritative` 를 다루는 단언을 전부 `runtime.test.ts` 에서
// `load: () => ({ records, authoritative: true })` 로 **주입**했다. 그래서 판정을 만드는 파서는
// 한 번도 실행되지 않았고, top-level 형상 오류(`grants: []` 등)가 "정상적인 빈 저장소" 로
// 통과하는 것을 아무도 잡지 못했다 — D-055/D-059 가 말한 "테스트가 production 경로에 진입하지
// 않는다" 의 네 번째 재발이다. 여기서는 production export 를 직접 부른다.

const validSecretGrant = {
  kind: 'secret',
  vaultKey: 'provider:corp:pat@1',
  authKind: 'pat',
  createdAt: 1
}

describe('parseGrantRecords — top-level 형상', () => {
  // 신규 설치: 키가 아직 쓰인 적이 없다. **이것만이** 정상적인 빈 저장소다.
  it('키 부재(undefined)는 권위 있는 빈 저장소다', () => {
    const parsed = parseGrantRecords(undefined)
    expect(parsed.records).toEqual({})
    expect(parsed.wellFormed).toBe(true)
    expect(isAuthoritative(parsed)).toBe(true)
  })

  it('빈 객체는 권위 있는 빈 저장소다', () => {
    const parsed = parseGrantRecords({})
    expect(parsed.records).toEqual({})
    expect(isAuthoritative(parsed)).toBe(true)
  })

  // 여기가 회귀의 본체다. 이 네 값이 `undefined` 와 같은 결론을 내면 부팅 sweep 이 멀쩡한
  // vault 를 통째로 비운다.
  it.each([
    ['배열', [] as unknown],
    ['null', null as unknown],
    ['문자열', 'grants' as unknown],
    ['숫자', 3 as unknown]
  ])('맵이 아닌 top-level(%s)은 권위가 없다', (_label, raw) => {
    const parsed = parseGrantRecords(raw)
    expect(parsed.wellFormed).toBe(false)
    expect(isAuthoritative(parsed)).toBe(false)
    // 읽어낸 것이 없다는 사실 자체는 같다 — 다른 것은 "그것을 사실로 믿어도 되는가" 뿐이다.
    expect(parsed.records).toEqual({})
  })
})

// 만료 정착은 재시작을 넘어야 한다 (0194 D20).
//
// `markExpired` 는 갈래를 가리지 않고 `expiresAt` 을 못 박는데(`store.ts`), 파서가 secret·session
// 분기에서 그것을 읽지 않던 동안 **죽은 연결이 재시작 후 `valid` 로 돌아왔다**. 화면은 그것을
// "연결됨" 으로 보여주고, 0194 의 회복 패스는 `status==='expired'` 만 대상으로 삼으므로 그 grant 는
// 회복 대상에서도 빠진다.
describe('parseGrantRecords — 만료 정착의 왕복 (0194)', () => {
  const EXPIRED_AT = 1_600_000_000_000
  const AFTER = EXPIRED_AT + 1

  const sessionGrant = {
    kind: 'session',
    sessionGroup: 'corp',
    authKind: 'browser-session',
    createdAt: 1
  }

  it('secret grant 의 expiresAt 이 왕복한다', () => {
    const parsed = parseGrantRecords({ corp: { ...validSecretGrant, expiresAt: EXPIRED_AT } })
    expect(parsed.records.corp).toMatchObject({ kind: 'secret', expiresAt: EXPIRED_AT })
  })

  it('session grant 의 expiresAt 이 왕복한다', () => {
    const parsed = parseGrantRecords({ corp: { ...sessionGrant, expiresAt: EXPIRED_AT } })
    expect(parsed.records.corp).toMatchObject({ kind: 'session', expiresAt: EXPIRED_AT })
  })

  // 파싱 결과만 보면 **소비처가 그 필드를 안 읽는 경우**를 놓친다 — 실제 판정까지 내려가 관측한다.
  it('파싱한 grant 를 store 에 심으면 status 가 expired 다', () => {
    const parsed = parseGrantRecords({ corp: { ...sessionGrant, expiresAt: EXPIRED_AT } })
    const store = new AuthStore({
      persistence: createMemoryGrantPersistence(parsed.records),
      vault: createVault(fakeSecretStore()),
      clock: () => AFTER
    })
    // 부팅이 실제로 지나는 경로다 — 파서 → `restore` → `status`.
    store.restore(['corp' as AuthId])
    expect(store.status('corp' as AuthId)).toBe('expired')
  })
})

describe('parseGrantRecords — 레코드 단위', () => {
  it('정상 레코드는 그대로 살아남는다', () => {
    const parsed = parseGrantRecords({ corp: validSecretGrant })
    expect(parsed.records.corp).toMatchObject({ kind: 'secret', vaultKey: 'provider:corp:pat@1' })
    expect(parsed.dropped).toBe(0)
    expect(isAuthoritative(parsed)).toBe(true)
  })

  // 0194 — refresh 만료가 재시작을 넘어와야 한다. 잃으면 이미 만료된 refresh token 으로
  // 매 부팅마다 왕복을 한 번씩 버린다(그리고 그 뒤에야 재로그인한다).
  it('token grant 의 refresh 좌표와 만료가 왕복한다', () => {
    const raw = {
      corp: {
        kind: 'token',
        vaultKey: 'provider:corp:oauth@2',
        refreshKey: 'provider:corp:oauth#refresh@2',
        refreshExpiresAt: 1_700_000_000_000,
        expiresAt: 1_600_000_000_000,
        authKind: 'oauth',
        createdAt: 1_500_000_000_000
      }
    }
    const parsed = parseGrantRecords(raw)
    expect(parsed.records.corp).toEqual({
      kind: 'token',
      vaultKey: 'provider:corp:oauth@2',
      refreshKey: 'provider:corp:oauth#refresh@2',
      refreshExpiresAt: 1_700_000_000_000,
      expiresAt: 1_600_000_000_000,
      authKind: 'oauth',
      createdAt: 1_500_000_000_000
    })
    expect(isAuthoritative(parsed)).toBe(true)
  })

  it('refreshExpiresAt 이 숫자가 아니면 그 필드만 빠지고 grant 는 산다', () => {
    const parsed = parseGrantRecords({
      corp: {
        kind: 'token',
        vaultKey: 'k',
        refreshKey: 'r',
        refreshExpiresAt: 'soon',
        authKind: 'oauth',
        createdAt: 1
      }
    })
    // 만료를 모르는 것은 "만료됨" 이 아니다 — grant 를 버리면 살아 있는 refresh 를 잃는다.
    expect(parsed.records.corp).not.toHaveProperty('refreshExpiresAt')
    expect(parsed.records.corp).toMatchObject({ kind: 'token', refreshKey: 'r' })
    expect(parsed.dropped).toBe(0)
  })

  // 부분 파싱: 살아남은 것은 쓰되, 버린 레코드의 vaultKey 를 모르므로 권위는 잃는다(r9).
  it('레코드 하나를 버리면 나머지는 살리되 권위를 잃는다', () => {
    const parsed = parseGrantRecords({ corp: validSecretGrant, broken: { kind: 'secret' } })
    expect(Object.keys(parsed.records)).toEqual(['corp'])
    expect(parsed.dropped).toBe(1)
    expect(parsed.wellFormed).toBe(true)
    expect(isAuthoritative(parsed)).toBe(false)
  })
})

describe('parsePendingRecords', () => {
  // grant 와 **같은 함수**를 쓴다 — 한쪽만 고쳐지는 것을 막는 것이 공유의 목적이다.
  it('맵이 아닌 top-level 은 권위가 없다', () => {
    expect(isAuthoritative(parsePendingRecords([]))).toBe(false)
    expect(isAuthoritative(parsePendingRecords(undefined))).toBe(true)
  })

  it('정상 pending 을 해석한다', () => {
    const parsed = parsePendingRecords({
      corp: { authId: 'corp', state: 's', verifier: 'v', createdAt: 1 }
    })
    expect(parsed.records.corp).toMatchObject({ authId: 'corp', state: 's' })
    expect(isAuthoritative(parsed)).toBe(true)
  })
})

describe('isAuthoritative', () => {
  // 두 축이 **각각** 권위를 무너뜨린다. 하나만 보면 다른 하나가 뚫린다(r9 는 dropped 만 봤다).
  it.each([
    ['둘 다 정상', { records: {}, dropped: 0, wellFormed: true }, true],
    ['레코드를 버렸다', { records: {}, dropped: 1, wellFormed: true }, false],
    ['top-level 이 깨졌다', { records: {}, dropped: 0, wellFormed: false }, false]
  ])('%s → %s', (_label, parsed, expected) => {
    expect(isAuthoritative(parsed as ParsedRecordMap<unknown>)).toBe(expected)
  })
})
