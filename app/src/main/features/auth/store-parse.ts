// 영속 레코드의 형상 검사 (0181 → 0188 r10 분리).
//
// **electron 을 물지 않는다.** 형상 검사와 "영속된 전체를 안다" 판정은 순수 함수이므로 단위
// 테스트가 그대로 부를 수 있어야 한다 — 같은 파일에 `new Store()` 가 있으면 import 만으로
// electron 이 필요해져 그 테스트를 쓸 수 없다(`vitest.config.ts` 는 electron 비의존 모듈만
// 대상으로 한다). r9 까지 `authoritative` 를 다루는 단언이 전부 결과를 **주입**해서 이 파서
// 경로에 한 번도 진입하지 못한 것이 그 때문이다(D-055·D-059).
//
// 파일 어댑터는 `store-file.ts`, `Grant` 는 contracts 타입이다.

import { isRecord } from '../../../shared/obj'
import type { ProviderAuthKind } from '../../../shared/ipc'
import { ProviderAuthKindSchema } from '../../../shared/protocol'
import type { Grant } from '../../contracts/auth'
import type { PendingAuthorization } from './oauth'

// 방식 목록의 정본은 wire 스키마다 (0190). 0188 은 같은 5개를 여기 다시 적었는데, 그 목록은
// `AuthMethodKind = ProviderAuthKind` 로 계약에 묶여 있어 **두 사본이 반드시 함께 움직여야**
// 한다 — 한쪽만 늘면 새 방식으로 저장된 grant 를 재시작 후 못 읽는다(조용히 미인증이 된다).
function isAuthKind(value: unknown): value is ProviderAuthKind {
  return ProviderAuthKindSchema.safeParse(value).success
}

function parseGrant(raw: unknown): Grant | null {
  if (!isRecord(raw)) return null
  const record = raw
  if (!isAuthKind(record.authKind)) return null
  if (typeof record.createdAt !== 'number') return null
  const base = {
    authKind: record.authKind,
    createdAt: record.createdAt,
    ...(typeof record.principalId === 'string' ? { principalId: record.principalId } : {})
  }
  switch (record.kind) {
    case 'secret':
      if (typeof record.vaultKey !== 'string') return null
      return { kind: 'secret', vaultKey: record.vaultKey, ...base }
    case 'token':
      if (typeof record.vaultKey !== 'string') return null
      return {
        kind: 'token',
        vaultKey: record.vaultKey,
        ...(typeof record.expiresAt === 'number' ? { expiresAt: record.expiresAt } : {}),
        ...(typeof record.refreshKey === 'string' ? { refreshKey: record.refreshKey } : {}),
        ...base
      }
    case 'session':
      if (typeof record.sessionGroup !== 'string') return null
      return { kind: 'session', sessionGroup: record.sessionGroup, ...base }
    default:
      return null
  }
}

function parsePending(raw: unknown): PendingAuthorization | null {
  if (!isRecord(raw)) return null
  const record = raw
  if (typeof record.authId !== 'string') return null
  if (typeof record.state !== 'string') return null
  if (typeof record.verifier !== 'string') return null
  if (typeof record.createdAt !== 'number') return null
  return {
    authId: record.authId,
    state: record.state,
    verifier: record.verifier,
    createdAt: record.createdAt,
    ...(typeof record.redirectUri === 'string' ? { redirectUri: record.redirectUri } : {})
  }
}

// 형상이 깨진 레코드는 **그 하나만** 버린다. 파일 전체를 버리면 provider 하나의 손상이 나머지
// 로그인까지 날린다.
//
// **버린 개수를 함께 돌려준다** (r9). 버린 레코드의 `vaultKey` 는 읽을 수 없으므로, 하나라도
// 버렸으면 "영속된 grant 전체를 안다" 가 거짓이다 — 그 상태로 vault sweep 을 돌리면 멀쩡한
// secret 을 고아로 오인해 지운다.
//
// ── top-level 형상도 같은 축이다 (r10) ────────────────────────────────────────
// r9 는 **레코드 단위**만 셌다. 그래서 `grants: []` · `null` · `"x"` 처럼 맵 자체가 깨진 파일이
// `{records:{}, dropped:0}` 을 내고 — **키가 아예 없는 신규 설치와 글자까지 같은 값**이라 —
// sweep 이 "영속된 grant 가 하나도 없다" 는 권위 있는 사실로 읽어 vault 를 통째로 비운다.
// grant 파일만 손상되고 secret 파일은 멀쩡한 흔한 경우에 **부팅 한 번으로 자격증명이 복구
// 불가능하게 삭제**된다.
//
// 그래서 "정상적으로 비었다"(`undefined` = 키 부재)와 "맵이 아니다" 를 가른다. 후자는 무엇이
// 있었는지 알 수 없으므로 `wellFormed:false` 다.
export interface ParsedRecordMap<T> {
  records: Record<string, T>
  dropped: number
  // top-level 값이 "레코드 맵" 또는 "아직 쓰인 적 없음" 이었는가.
  wellFormed: boolean
}

function parseRecordMap<T>(
  raw: unknown,
  parseOne: (value: unknown) => T | null
): ParsedRecordMap<T> {
  // 키 부재 = 아직 아무것도 저장한 적이 없다. **이것만이** 정상적인 빈 저장소다.
  if (raw === undefined) return { records: {}, dropped: 0, wellFormed: true }
  if (!isRecord(raw)) return { records: {}, dropped: 0, wellFormed: false }
  const records: Record<string, T> = {}
  let dropped = 0
  for (const [key, value] of Object.entries(raw)) {
    const parsed = parseOne(value)
    if (parsed) records[key] = parsed
    else dropped += 1
  }
  return { records, dropped, wellFormed: true }
}

// 파싱 결과 → "영속된 전체를 안다" 판정. 규칙이 여기 하나로 있어야 테스트가 production 규칙을
// 그대로 부른다 — 파일 어댑터 안에 인라인으로 두면 테스트가 규칙을 재구현하게 된다(D-055).
export function isAuthoritative<T>(parsed: ParsedRecordMap<T>): boolean {
  return parsed.wellFormed && parsed.dropped === 0
}

export function parseGrantRecords(raw: unknown): ParsedRecordMap<Grant> {
  return parseRecordMap(raw, parseGrant)
}

export function parsePendingRecords(raw: unknown): ParsedRecordMap<PendingAuthorization> {
  return parseRecordMap(raw, parsePending)
}
