// Grant 스토어 (0181 → 0188) — `authId → Grant` **단일 맵**의 메모리 상태 + 영속.
//
// 여기에는 **비밀이 없다.** 값은 vault(safeStorage 암호문)에만 있고 이 파일이 나르는 것은
// vault 키·상태·만료 같은 메타뿐이다. 이 레코드가 하는 일은 **재시작 후 vault 키를 다시 찾는
// 것**이다.
//
// 영속과 vault 는 **주입 포트**다 — electron-store 를 물면 단위 테스트가 electron 을 요구한다.

import type { AuthId, AuthMethodKind, AuthStatus, Grant } from '../../contracts/auth'
import type { Vault } from '../../infra/vault'

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

// `captureForRollback` 이 뜬 지점. 값이 아니라 **되돌릴 좌표**만 담는다 — vault 값 복원은
// 호출부(`login.ts`)가 자기 쓰기와 짝지어 처리한다.
export interface AuthRollbackPoint {
  authId: AuthId
  grant: Grant | undefined
  verified: boolean
  revision: number
}

export interface AuthStoreDeps {
  persistence: GrantPersistencePort
  vault: Vault
  clock?: () => number
  // 선언에 없는 id 를 만났을 때의 통지. 삭제하지 않고 로그만 남긴다(§파생 UX 고아 grant).
  onOrphan?: (authId: AuthId) => void
}

export class AuthStore {
  private readonly grants = new Map<string, Grant>()
  // **이번 실행에서 실제 인증을 거친 provider.** 프로세스 수명 한정 — 영속하지 않는다.
  //
  // grant 는 *기록*이고 인증이 아니다. 특히 `kind:'session'` grant 는 vault 도 `expiresAt` 도
  // 없어(교환 없는 ADFS 경로) 기록만으로 영원히 `status:'valid'` 다. 게이트가 그 status 만 보던
  // 동안 한 번 로그인에 성공한 authId 는 영구히 통과했다 — 쿠키가 죽어도 마찬가지라
  // 사실상 `authBypass` 를 켠 것과 같았다(사용자 보고). 그래서 통과 근거를 *기록* 이 아니라
  // **이번 실행의 인증**으로 옮긴다. 디스크에 남기는 순간 그 영구 bypass 가 그대로 돌아온다.
  private readonly verified = new Set<string>()
  // **실행 credential 이 실제로 바뀐 횟수** (0188). 메모리 단조 — 프로세스 수명 한정이라
  // 영속하지 않는다.
  //
  // 왜 필요한가: `AuthChange` 소비자(Harness runtime config cache · Plugin tool sync)는 "지금
  // 값이 그때 값과 같은가" 를 알아야 하는데, `status` 는 같은 값으로 여러 번 돌아온다(입력 폼을
  // 열었다 닫아도 `none` 이고, probe 를 다시 돌려도 `valid` 다). revision 이 없으면 소비자는
  // 매 change 마다 무효화하거나(불필요한 network·respawn) 아무것도 안 하거나(stale token)
  // 둘 중 하나로 몰린다.
  //
  // **같은 상태를 다시 관측했다고 올리지 않는다** — commit·revoke·만료 전이·401/403 강등만
  // 올린다. 그 판정은 각 mutator 안에 있다.
  private readonly revisions = new Map<string, number>()
  private readonly persistence: GrantPersistencePort
  private readonly vault: Vault
  private readonly clock: () => number
  private readonly onOrphan?: (authId: AuthId) => void

  constructor(deps: AuthStoreDeps) {
    this.persistence = deps.persistence
    this.vault = deps.vault
    this.clock = deps.clock ?? Date.now
    this.onOrphan = deps.onOrphan
  }

  // 부팅 복원. **선언에 없는 id 는 조용히 무시하고 로그만 남긴다** — 삭제하지 않는다.
  // 선언이 일시적으로 빠진 빌드에서 재로그인을 강요하지 않기 위함이다.
  // 복원된 grant 는 **`verified` 가 아니다** — 기록이 살아 있다는 것과 지금 인증돼 있다는 것은
  // 다르다. 게이트를 열려면 이번 실행에서 로그인을 한 번 거쳐야 한다.
  restore(declaredIds: readonly AuthId[]): void {
    const known = new Set(declaredIds)
    this.grants.clear()
    this.verified.clear()
    // 복원은 부팅 1회이고 구독자가 붙기 전이다 — 세대도 함께 초기화한다.
    this.revisions.clear()
    for (const [authId, grant] of Object.entries(this.persistence.load())) {
      if (!known.has(authId)) {
        this.onOrphan?.(authId)
        continue
      }
      this.grants.set(authId, grant)
    }
  }

  // 실행 credential 세대. 한 번도 바뀐 적 없으면 0.
  credentialRevision(authId: AuthId): number {
    return this.revisions.get(authId) ?? 0
  }

  private bumpRevision(authId: AuthId): void {
    this.revisions.set(authId, this.credentialRevision(authId) + 1)
  }

  // 이번 실행에서 인증이 확인됐는가. grant 가 없으면 당연히 거짓이다.
  isVerified(authId: AuthId): boolean {
    return this.verified.has(authId) && this.grants.has(authId)
  }

  // 확인 성립. `put`(방금 로그인) 외의 유일한 진입점은 자동 로그인(`LoginService.resume`)이다.
  markVerified(authId: AuthId): void {
    if (this.grants.has(authId)) this.verified.add(authId)
  }

  get(authId: AuthId): Grant | undefined {
    return this.grants.get(authId)
  }

  // 방금 인증에 성공한 결과가 들어온다 — 그러므로 이 grant 는 이번 실행에서 확인된 것이다.
  put(authId: AuthId, grant: Grant): void {
    this.grants.set(authId, grant)
    this.verified.add(authId)
    // credential commit — 실행 구성이 실제로 달라졌다.
    this.bumpRevision(authId)
    this.flush()
  }

  // 해제 — grant 와 vault 잔여물을 함께 지운다. secret/token 이 아닌 session grant 는
  // vault 에 값이 없으므로 cookie jar 정리는 호출부(browser session)가 맡는다.
  revoke(authId: AuthId): Grant | undefined {
    const grant = this.grants.get(authId)
    if (!grant) return undefined
    if (grant.kind === 'secret' || grant.kind === 'token') this.vault.delete(grant.vaultKey)
    if (grant.kind === 'token' && grant.refreshKey) this.vault.delete(grant.refreshKey)
    this.grants.delete(authId)
    this.verified.delete(authId)
    this.bumpRevision(authId)
    this.flush()
    return grant
  }

  // 만료된 토큰을 `expired` 로 강등한다(401 관측 또는 `expiresAt` 경과). grant 자체는 남긴다 —
  // 사용자가 어느 provider 를 다시 인증해야 하는지 화면에서 봐야 한다.
  status(authId: AuthId): AuthStatus {
    const grant = this.grants.get(authId)
    if (!grant) return 'none'
    const expired = grant.expiresAt !== undefined && grant.expiresAt <= this.clock()
    if (grant.kind === 'session') return expired ? 'expired' : 'valid'
    const read = this.vault.read(grant.vaultKey)
    if (read.state === 'undecryptable') return 'unknown'
    if (read.state === 'absent') return 'none'
    return expired ? 'expired' : 'valid'
  }

  // 401 관측 시 강등. **grant 를 지우지 않는다** — 사용자가 어느 provider 를 다시 인증해야
  // 하는지 화면에서 봐야 하고, 재인증이 기존 항목을 교체하는 형태여야 하기 때문이다.
  markExpired(authId: AuthId): void {
    const grant = this.grants.get(authId)
    if (!grant) return
    // 확인은 무조건 취소한다 — 401 을 봤는데 "확인됨" 을 남겨 두면 게이트가 열린 채로 남는다.
    // (아래 조기 반환보다 앞이어야 한다: 이미 만료 표기된 grant 도 확인은 풀려야 한다.)
    this.verified.delete(authId)
    const now = this.clock()
    // 이미 만료 표기된 grant 를 다시 강등해도 실행 credential 은 그대로다 — revision 을 올리면
    // 401 을 두 번 본 것만으로 Harness cache 가 두 번 무효화된다.
    if (grant.expiresAt !== undefined && grant.expiresAt <= now) return
    this.grants.set(authId, { ...grant, expiresAt: now })
    this.bumpRevision(authId)
    this.flush()
  }

  // ── 재인증 롤백 (0188 D-009) ────────────────────────────────────────────────
  //
  // `reauth` 는 기존 grant 를 먼저 지우지 않는다(0181 AC6). 하지만 값형 방식은 **probe 전에
  // vault 를 덮어쓰므로**, 새 값이 거부되면 이전 자격증명이 이미 사라져 있었다 — 0181 구현이
  // 그것을 주석으로 인정하고 있었다("이전 자격증명은 이미 같은 vault 키에 덮여 복구되지 않는다").
  //
  // 0188 은 그 자리를 메운다: 호출부가 쓰기 전에 여기서 상태를 떠 두고, 실패하면 되돌린다.
  // **`credentialRevision` 도 함께 되돌린다** — 실패한 재인증은 실행 credential 을 바꾸지
  // 않았으므로 Harness cache 를 무효화할 이유가 없다.
  captureForRollback(authId: AuthId): AuthRollbackPoint {
    return {
      authId,
      grant: this.grants.get(authId),
      verified: this.verified.has(authId),
      revision: this.credentialRevision(authId)
    }
  }

  rollback(point: AuthRollbackPoint): void {
    if (point.grant) this.grants.set(point.authId, point.grant)
    else this.grants.delete(point.authId)
    if (point.verified) this.verified.add(point.authId)
    else this.verified.delete(point.authId)
    this.revisions.set(point.authId, point.revision)
    this.flush()
  }

  // ── 시간 기반 만료의 1회 전이 (0188 D-037) ──────────────────────────────────
  //
  // `status()` 는 `expiresAt <= now` 를 **매번 다시 계산**한다 — 순수 조회라 부수효과가 없다.
  // 그래서 시계가 지나 만료된 토큰은 status 만 `expired` 로 보이고 `verified` 는 남으며
  // `credentialRevision` 도 그대로다. 그 상태로 두면 게이트가 열린 채 남고 Harness cache 가
  // 죽은 토큰을 계속 warm hit 로 돌려준다.
  //
  // 이 함수는 그 전이를 **처음 관측한 지점에서 한 번** 정착시킨다. polling 을 새로 만들지
  // 않는 이유가 이것이다 — snapshot·request·resume 이 이미 지나는 자리에서 부른다.
  // 이미 정착된 grant 에는 아무 일도 하지 않는다(`markExpired` 의 조기 반환).
  //
  // 돌려주는 값은 **이번 호출에서 실제로 전이가 일어났는가** 다. 호출자(runtime)가 그때만
  // credential-effective change 를 emit 한다.
  settleExpiry(authId: AuthId): boolean {
    const grant = this.grants.get(authId)
    if (!grant) return false
    if (grant.expiresAt === undefined || grant.expiresAt > this.clock()) return false
    const before = this.credentialRevision(authId)
    const wasVerified = this.verified.has(authId)
    this.markExpired(authId)
    return this.credentialRevision(authId) !== before || wasVerified
  }

  authKind(authId: AuthId): AuthMethodKind | null {
    return this.grants.get(authId)?.authKind ?? null
  }

  // ── 체인 도중의 grant 변경 판정 (0187 r2) ────────────────────────────────────
  //
  // 요청 하나가 redirect 를 도는 동안 다른 IPC(해제·재인증)나 다른 요청의 401 강등이 끼어들 수
  // 있다. 홉마다 자격증명을 다시 풀던 시절에는 그 변화가 자동으로 보였는데, 요청당 1회 해석으로
  // 접으면서 보이지 않게 됐다 — 여기 두 판정이 그것을 **vault 를 읽지 않고** 되돌린다.
  //
  // **왜 generation 카운터가 아니라 객체 참조인가.** `put()` 자체는 새 객체를 보장하지 않는다 —
  // 전달받은 grant 를 그대로 넣는다(아래 `put`). 성립 근거는 **현재 호출부의 성질**이다:
  // `revoke()` 는 엔트리를 삭제하고, `markExpired()` 는 spread 로 새 객체를 넣으며, 재인증은
  // `LoginService` 가 새 `Grant` 리터럴을 만들어 `put` 한다. 그래서 참조 비교가 generation 역할을
  // 한다. **호출부가 grant 를 제자리 변형(mutate)하기 시작하면 이 전제가 깨진다.**

  // 세션용 — identity 만 본다. 변경 전에도 세션 경로는 홉마다 `expiresAt` 을 보지 않았으므로
  // (`store.get()` 후 곧바로 cookie jar 전송) 여기서 만료를 더하면 없던 정책이 새로 생긴다.
  isCurrentGrant(authId: AuthId, expected: Grant): boolean {
    return this.grants.get(authId) === expected
  }

  // 값형용 — identity + 만료. 변경 전 `secret()` 이 홉마다 만료를 다시 봤다.
  // **vault 존재·복호화 가능성은 보지 않는다** — 그쪽은 요청당 1회 snapshot 과 맞바꾼 부분이라
  // 이름을 `usable` 이 아니라 `currentUnexpired` 로 둔다.
  isCurrentUnexpiredGrant(authId: AuthId, expected: Grant): boolean {
    const current = this.grants.get(authId)
    if (current !== expected) return false
    return current.expiresAt === undefined || current.expiresAt > this.clock()
  }

  // 유효할 때만 값을 준다 — 만료·복호화 실패 상태의 값을 요청에 싣지 않는다.
  //
  // `status()` 를 부르고 vault 를 또 읽지 않는다. `SecretStore.get` 은 호출마다 파일을
  // 다시 읽고 복호화하므로(캐시 없음) 두 번 물으면 턴마다 그 값을 두 번 낸다 —
  // `status()` 의 값형 판정은 곧 `read.state === 'found' && !expired` 라, 한 번 읽어 둘 다 답한다.
  secret(authId: AuthId): string | null {
    const grant = this.grants.get(authId)
    if (!grant || grant.kind === 'session') return null
    if (grant.expiresAt !== undefined && grant.expiresAt <= this.clock()) return null
    const read = this.vault.read(grant.vaultKey)
    return read.state === 'found' ? read.value : null
  }

  private flush(): void {
    this.persistence.save(Object.fromEntries(this.grants))
  }
}
