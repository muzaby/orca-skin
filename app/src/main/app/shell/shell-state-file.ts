// 셸 상태의 파일 배선 (0324 EP-13·EP-14). 판정은 `shell-state.ts` 가 갖는다 — 이 파일은
// `electron-store` 를 물어 단위 테스트가 직접 import 하지 않는다.

import Store from 'electron-store'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PRODUCT_SLUG } from '../../../shared/product'
import { ShellState } from './shell-state'

const STATE_KEY = 'state'

export function openShellState(userDataDir: string): ShellState {
  const store = new Store<Record<string, unknown>>({
    name: `${PRODUCT_SLUG}-shell-state`,
    cwd: userDataDir,
    // 손상된 셸 스냅샷은 유효한 레거시 설정을 이어받을 수 있게 빈 상태로 읽는다.
    clearInvalidConfig: true,
    defaults: {}
  })
  return new ShellState(
    {
      read: () => store.get(STATE_KEY),
      write: (record) => store.set(STATE_KEY, record)
    },
    // 기존 설정 파일은 읽기만 한다 — 쓰는 주체는 데이터 호스트 하나다(D-029·D-036).
    () =>
      JSON.parse(
        readFileSync(join(userDataDir, `${PRODUCT_SLUG}-settings.json`), 'utf8')
      ) as unknown
  )
}
