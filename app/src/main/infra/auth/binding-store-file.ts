// binding 레코드 영속 어댑터 (0170) — `BindingPersistence` 의 electron-store 구현.
//
// **여기에는 비밀이 없다.** 값은 `SecretStore`(safeStorage 암호문)에만 있고 이 파일에 남는 것은
// binding handle·target·상태 같은 메타뿐이다 — 이미 renderer 로 나가는 DTO(`AuthBindingInfo`)와
// 같은 형상이다. 이 레코드가 하는 일은 **재시작 후 vault 네임스페이스를 다시 찾는 것**이다
// (네임스페이스가 `authBindingPrefix(binding.id)` 라 id 가 곧 열쇠다).
//
// 형상 검사는 `binding-records.ts` 에 있다 — 이 파일은 electron-store 를 물어 테스트가 안 된다.

import Store from 'electron-store'
import type { AuthBindingInfo } from '../../../shared/ipc'
import { parseBindingRecords } from './binding-records'

// 한 번 정하면 유지한다 — 사용자 디스크에 남고 다음 버전이 읽는다.
const STORE_NAME = 'orca-auth-bindings'
const RECORDS_KEY = 'bindings'

export interface BindingPersistencePort {
  load(): AuthBindingInfo[]
  save(records: readonly AuthBindingInfo[]): void
}

export function createBindingPersistence(): BindingPersistencePort {
  const store = new Store<Record<string, unknown>>({ name: STORE_NAME, defaults: {} })
  return {
    load(): AuthBindingInfo[] {
      try {
        return parseBindingRecords(store.get(RECORDS_KEY))
      } catch {
        // 파일 자체가 JSON 이 아니면 electron-store 가 던진다. 그래도 앱은 떠야 한다.
        return []
      }
    },
    save(records: readonly AuthBindingInfo[]): void {
      store.set(RECORDS_KEY, records)
    }
  }
}
