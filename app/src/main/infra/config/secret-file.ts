// 비밀 파일 열기 (0324 EP-13 · EP-18). `electron-store` 를 무는 자리를 캐시(`secret-store.ts`)에서 뗐다 —
// 캐시는 순수 모듈로 남아 vitest 가 직접 import 한다.

import Store from 'electron-store'
import { PRODUCT_SLUG } from '../../../shared/product'
import type { SecretFile } from './secret-store'

type Raw = Record<string, unknown>

export function openSecretFile(cwd: string): SecretFile {
  // `cwd` 는 필수다 — 생략하면 `app` 이 없는 프로세스에서 다른 디렉토리에 쓴다(0324 D-031).
  const store = new Store<Raw>({ name: `${PRODUCT_SLUG}-secrets`, cwd, defaults: {} })
  return {
    entries: () => Object.entries(store.store),
    get: (name) => store.get(name),
    set: (name, value) => store.set(name, value),
    delete: (name) => store.delete(name)
  }
}
