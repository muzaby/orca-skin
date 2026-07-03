// MCP·orca.json 공용 비밀 저장소. 값은 env-var **이름**으로 키잉한다(서버 id 아님) — 여러 서버가 같은
// ${TOKEN} 을 공유할 수 있게. 저장 형태는 { [VAR]: authEncBase64 }(safeStorage 암호문).
// mcp.json 에는 ${VAR} 플레이스홀더만 남고, 실제 비밀은 여기(<userData>) 에만 존재한다.

import Store from 'electron-store'
import { encrypt, safeDecrypt } from './crypto'

type Raw = Record<string, unknown>

export class SecretStore {
  private readonly store = new Store<Raw>({ name: 'orca-secrets', defaults: {} })

  // env-var 이름 → 평문 비밀. 미존재/복호화 실패 시 undefined.
  get(name: string): string | undefined {
    const enc = this.store.get(name)
    if (typeof enc !== 'string') return undefined
    return safeDecrypt(enc) ?? undefined
  }

  set(name: string, plain: string): void {
    this.store.set(name, encrypt(plain))
  }

  has(name: string): boolean {
    return typeof this.store.get(name) === 'string'
  }

  delete(name: string): void {
    this.store.delete(name)
  }
}
