// Grant 영속 어댑터 (0181 — 0180 이 지운 `infra/auth/binding-store-file.ts` 복원).
//
// **여기에는 비밀이 없다.** 값은 vault(safeStorage 암호문)에만 있고 이 파일에 남는 것은 vault
// 키·방식·만료 같은 메타뿐이다 — 이미 renderer 로 나가는 DTO 와 같은 급의 정보다.
//
// 형상 검사와 권위 판정은 `store-parse.ts` 가 갖는다(r10 분리) — 이 파일은 electron-store 를
// 물기 때문에 단위 테스트가 import 할 수 없고, 그래서 순수 규칙이 여기 있으면 테스트가 그것을
// 재구현하거나 결과를 주입하게 된다. `Grant` 가 contracts 타입이라 이 어댑터는 infra 가 아니라
// feature 에 산다(infra → contracts 는 DAG 역방향).

import Store from 'electron-store'
import type { Grant } from '../../contracts/auth'
import type { GrantPersistencePort, PersistenceLoad } from './store'
import type { OAuthStatePersistencePort, PendingAuthorization } from './oauth'
import {
  isAuthoritative,
  parseGrantRecords,
  parsePendingRecords,
  type ParsedRecordMap
} from './store-parse'

// 한 번 정하면 유지한다 — 사용자 디스크에 남고 다음 버전이 읽는다.
const STORE_NAME = 'orca-provider-grants'
const RECORDS_KEY = 'grants'

// ── OAuth 인가 pending (0181 AC4) ─────────────────────────────────────────────
//
// **왜 파일인가**: 루프백 콜백은 사용자의 브라우저가 앱 밖에서 완료시킨다. 그 사이 앱이
// 재시작되면 메모리의 state·verifier 가 사라져 돌아온 콜백을 대조할 수 없다 — 대조 실패는
// 곧 로그인 실패다. grant 와 **다른 파일**에 두는 이유는 수명이 다르기 때문이다(인가 pending 은
// 분 단위, grant 는 재로그인까지).
const OAUTH_STORE_NAME = 'orca-provider-oauth'
const PENDING_KEY = 'pending'

// ── 파일 어댑터 ───────────────────────────────────────────────────────────────
//
// grant 와 OAuth pending 은 **같은 모양**이다 — `Record<string, T>` 하나를 키 하나에 얹은
// electron-store. 두 벌로 적으면 한쪽만 고쳐진다(실제로 grant 쪽에만 "JSON 이 아니어도 앱은
// 떠야 한다" 주석이 붙어 있었다).
//
// 스토어는 **처음 쓸 때 연다.** `new Store()` 는 생성자에서 디렉토리 확인 + 파일 읽기 +
// JSON 파싱을 동기로 한다. provider 부팅 단계는 renderer 의 첫 `orca:provider:state` 를
// 기다리게 하지 않으려고 DB 앞으로 일부러 당겨 둔 자리라, 그 앞에 동기 파일 열기를 놓으면
// 당겨 둔 만큼을 도로 쓴다 — OAuth pending 은 실제 OAuth 로그인이 돌 때만 읽힌다.
function createRecordPersistence<T>(options: {
  name: string
  key: string
  parse: (raw: unknown) => ParsedRecordMap<T>
  // 파일을 못 열면 메모리로 내려앉는다 — 이 프로세스 안에서는 동작하고, 재시작을 못 넘긴다.
  onUnavailable: (error: unknown) => void
}): { load(): PersistenceLoad<T>; save(records: Record<string, T>): boolean } {
  let store: Store<Record<string, unknown>> | null = null
  let unavailable = false
  let memory: Record<string, T> = {}

  const open = (): Store<Record<string, unknown>> | null => {
    if (store !== null || unavailable) return store
    try {
      store = new Store<Record<string, unknown>>({ name: options.name, defaults: {} })
    } catch (error) {
      unavailable = true
      options.onUnavailable(error)
    }
    return store
  }

  return {
    // ── `authoritative` 가 왜 필요한가 (r9) ───────────────────────────────────
    //
    // 이 함수는 실패해도 앱이 뜨도록 **빈 맵으로 강등**한다. 그런데 호출부(`AuthStore.restore`)는
    // 그 빈 맵을 "영속된 grant 는 하나도 없다" 는 **권위 있는 사실**로 읽고, 아무도 가리키지 않는
    // vault 자리를 전부 지운다. 즉 grant 파일 하나가 손상되면 멀쩡한 secret 이 부팅 한 번에
    // 통째로 사라진다.
    //
    // 그래서 "읽었다" 와 "다 읽었다" 를 구분한다. `authoritative:false` 면 호출부는 sweep 을
    // 건너뛴다 — 고아 정리는 위생 작업이라 미뤄도 되지만, 잘못 지운 secret 은 복구되지 않는다.
    load(): PersistenceLoad<T> {
      const opened = open()
      // 파일을 못 열었다 — 이 프로세스가 아는 것은 메모리 사본뿐이다.
      if (!opened) return { records: { ...memory }, authoritative: false }
      try {
        const parsed = options.parse(opened.get(options.key))
        // 레코드 하나라도 버렸거나 top-level 이 맵이 아니면 무엇이 있었는지 모른다 → 전체를
        // 안다고 말할 수 없다(r10 — 규칙은 `isAuthoritative` 하나가 갖는다).
        return { records: parsed.records, authoritative: isAuthoritative(parsed) }
      } catch (error) {
        // 파일 자체가 JSON 이 아니면 electron-store 가 던진다. 그래도 앱은 떠야 한다.
        options.onUnavailable(error)
        return { records: {}, authoritative: false }
      }
    },
    // **내구 저장에 성공했을 때만 `true`** (r8). 예전에는 쓰기 오류를 삼키고 `void` 를 돌려줘,
    // 호출부는 디스크 실패와 정상 저장을 구분할 방법이 아예 없었다 — 영속되지 않은 grant 를
    // 영속된 것처럼 publish 했다.
    //
    // **실패해도 던지지 않는다.** 파일을 못 열든 쓰기가 거부되든, 이 프로세스는 메모리 사본으로
    // 계속 동작해야 한다(키체인이 잠긴 머신에서 앱이 죽으면 안 된다). 대신 그 사실을 `false` 로
    // **말한다** — 이것을 "영속 성공" 으로 접지 않는 것이 r8 의 결정이다. 자격증명 호출부는
    // `false` 를 받으면 새 값을 이번 프로세스에서 쓰되 옛 vault 키를 지우지 않는다.
    save(records: Record<string, T>): boolean {
      memory = { ...records }
      const opened = open()
      if (!opened) return false
      try {
        opened.set(options.key, records)
        return true
      } catch (error) {
        unavailable = true
        store = null
        options.onUnavailable(error)
        return false
      }
    }
  }
}

export function createOAuthStatePersistence(
  onUnavailable: (error: unknown) => void
): OAuthStatePersistencePort {
  const inner = createRecordPersistence<PendingAuthorization>({
    name: OAUTH_STORE_NAME,
    key: PENDING_KEY,
    parse: parsePendingRecords,
    onUnavailable
  })
  // 인가 pending 은 분 단위 수명이고 sweep 대상도 아니다 — 권위 여부가 의미를 갖지 않으므로
  // 여기서 접어 버린다. 대조 실패는 그냥 로그인 실패다.
  return { load: () => inner.load().records, save: (records) => void inner.save(records) }
}

export function createGrantPersistence(
  onUnavailable: (error: unknown) => void
): GrantPersistencePort {
  return createRecordPersistence<Grant>({
    name: STORE_NAME,
    key: RECORDS_KEY,
    parse: parseGrantRecords,
    onUnavailable
  })
}
