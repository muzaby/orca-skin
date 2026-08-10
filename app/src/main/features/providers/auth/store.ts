// Grant 스토어 (0181) — `providerId → Grant` **단일 맵**의 메모리 상태 + 영속.
//
// 여기에는 **비밀이 없다.** 값은 vault(safeStorage 암호문)에만 있고 이 파일이 나르는 것은
// vault 키·상태·만료 같은 메타뿐이다. 이 레코드가 하는 일은 **재시작 후 vault 키를 다시 찾는
// 것**이다.
//
// 영속과 vault 는 **주입 포트**다 — electron-store 를 물면 단위 테스트가 electron 을 요구한다.

import type { ProviderAuthKind, ProviderGrantStatus } from '../../../../shared/ipc'
import type { Grant } from '../../../contracts/provider'
import type { Vault } from '../../../infra/vault'

export interface GrantPersistencePort {
  load(): Record<string, Grant>
  save(records: Record<string, Grant>): void
}

// 메모리 전용 폴백 — 테스트와 "영속 없이도 앱은 뜬다" 경로가 함께 쓴다.
export function createMemoryGrantPersistence(
  seed: Record<string, Grant> = {}
): GrantPersistencePort {
  let records = { ...seed }
  return {
    load: () => ({ ...records }),
    save: (next) => {
      records = { ...next }
    }
  }
}

export interface ProviderStoreDeps {
  persistence: GrantPersistencePort
  vault: Vault
  clock?: () => number
  // 선언에 없는 id 를 만났을 때의 통지. 삭제하지 않고 로그만 남긴다(§파생 UX 고아 grant).
  onOrphan?: (providerId: string) => void
}

export class ProviderStore {
  private readonly grants = new Map<string, Grant>()
  private readonly persistence: GrantPersistencePort
  private readonly vault: Vault
  private readonly clock: () => number
  private readonly onOrphan?: (providerId: string) => void

  constructor(deps: ProviderStoreDeps) {
    this.persistence = deps.persistence
    this.vault = deps.vault
    this.clock = deps.clock ?? Date.now
    this.onOrphan = deps.onOrphan
  }

  // 부팅 복원. **선언에 없는 id 는 조용히 무시하고 로그만 남긴다** — 삭제하지 않는다.
  // 선언이 일시적으로 빠진 빌드에서 재로그인을 강요하지 않기 위함이다.
  restore(declaredIds: readonly string[]): void {
    const known = new Set(declaredIds)
    this.grants.clear()
    for (const [providerId, grant] of Object.entries(this.persistence.load())) {
      if (!known.has(providerId)) {
        this.onOrphan?.(providerId)
        continue
      }
      this.grants.set(providerId, grant)
    }
  }

  get(providerId: string): Grant | undefined {
    return this.grants.get(providerId)
  }

  put(providerId: string, grant: Grant): void {
    this.grants.set(providerId, grant)
    this.flush()
  }

  // 해제 — grant 와 vault 잔여물을 함께 지운다. secret/token 이 아닌 session grant 는
  // vault 에 값이 없으므로 cookie jar 정리는 호출부(browser session)가 맡는다.
  revoke(providerId: string): Grant | undefined {
    const grant = this.grants.get(providerId)
    if (!grant) return undefined
    if (grant.kind === 'secret' || grant.kind === 'token') this.vault.delete(grant.vaultKey)
    if (grant.kind === 'token' && grant.refreshKey) this.vault.delete(grant.refreshKey)
    this.grants.delete(providerId)
    this.flush()
    return grant
  }

  // 만료된 토큰을 `expired` 로 강등한다(401 관측 또는 `expiresAt` 경과). grant 자체는 남긴다 —
  // 사용자가 어느 provider 를 다시 인증해야 하는지 화면에서 봐야 한다.
  status(providerId: string): ProviderGrantStatus {
    const grant = this.grants.get(providerId)
    if (!grant) return 'none'
    if (grant.kind === 'session') return 'valid'
    const read = this.vault.read(grant.vaultKey)
    if (read.state === 'undecryptable') return 'unknown'
    if (read.state === 'absent') return 'none'
    if (
      grant.kind === 'token' &&
      grant.expiresAt !== undefined &&
      grant.expiresAt <= this.clock()
    ) {
      return 'expired'
    }
    return 'valid'
  }

  authKind(providerId: string): ProviderAuthKind | null {
    return this.grants.get(providerId)?.authKind ?? null
  }

  // 유효할 때만 값을 준다 — 만료·복호화 실패 상태의 값을 요청에 싣지 않는다.
  secret(providerId: string): string | null {
    const grant = this.grants.get(providerId)
    if (!grant || grant.kind === 'session') return null
    if (this.status(providerId) !== 'valid') return null
    return this.vault.get(grant.vaultKey)
  }

  private flush(): void {
    this.persistence.save(Object.fromEntries(this.grants))
  }
}
