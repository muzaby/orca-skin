// Grant 스토어 (0181 → 0188) — `authId → Grant` **단일 맵**의 메모리 상태 + 영속.
//
// 여기에는 **비밀이 없다.** 값은 vault(safeStorage 암호문)에만 있고 이 파일이 나르는 것은
// vault 키·상태·만료 같은 메타뿐이다. 이 레코드가 하는 일은 **재시작 후 vault 키를 다시 찾는
// 것**이다.
//
// 영속과 vault 는 **주입 포트**다 — electron-store 를 물면 단위 테스트가 electron 을 요구한다.

import type { AuthId, AuthMethodKind, AuthStatus, Grant } from '../../contracts/auth'
import type { Vault } from '../../infra/vault'

// 한 Grant 가 가리키는 vault 키 전부 (0190).
//
// **이 규칙은 한 곳에만 있어야 한다.** 0188 은 같은 도출을 네 곳에 손으로 적었다 — 부팅 고아
// sweep(참조 집합)·해제(삭제 목록)·자격증명 교체의 `kept`·그 `names`. sweep 은 "이 키들은
// 살아 있다" 를, 삭제 쪽은 "이 키들을 지운다" 를 말하므로 **둘이 어긋나면 살아 있는 grant 가
// 가리키는 키를 부팅이 지운다** — 그리고 vault 값은 복구되지 않는다.
//
// `session` grant 는 vault 를 쓰지 않는다(cookie jar 가 값을 갖는다) → 빈 배열.
export function vaultKeysOf(grant: Grant | undefined): readonly string[] {
  if (!grant || grant.kind === 'session') return []
  if (grant.kind === 'token' && grant.refreshKey) return [grant.vaultKey, grant.refreshKey]
  return [grant.vaultKey]
}

// 부팅에서 읽어 온 것과 **그것이 전부인지**를 함께 돌려준다 (r9).
export interface PersistenceLoad<T> {
  records: Record<string, T>
  // 저장소를 열고 **끝까지** 읽었는가. `false` 면 이 맵은 "아는 만큼" 이지 "전부" 가 아니다 —
  // 호출부는 이것을 없음의 증거로 쓰면 안 된다.
  authoritative: boolean
}

export interface GrantPersistencePort {
  load(): PersistenceLoad<Grant>
  // **내구 저장 성공 여부를 돌려준다** (r8, 계약 통일 r9). 디스크에 실제로 앉았으면 `true`,
  // 아니면 `false` 다 — 파일을 못 열었든 쓰기가 거부됐든 구분하지 않는다. 둘 다 "재시작을
  // 못 넘긴다" 는 같은 사실이기 때문이다.
  //
  // **구현이 던져도 된다** — `AuthStore` 가 그것을 `false` 로 정규화한다. 호출부가 보는 신호는
  // 언제나 boolean 하나뿐이다(r8 은 throw 와 false 에 서로 다른 정책을 붙여, 같은 조건이 두
  // 갈래로 처리됐다).
  //
  // 왜 boolean 이 필요한가: production adapter 는 store 파일을 못 열면 메모리로 내려앉는다
  // (그래야 키체인이 잠긴 머신에서도 앱이 뜬다). 그 상태를 "저장 성공" 으로 뭉개면, 호출부는
  // 옛 자격증명을 지워도 된다고 믿는다 — 재시작하면 grant 는 옛 것으로 돌아가는데 그 키는
  // 이미 지워져 **아무것도 가리키지 않는 grant** 가 된다.
  //
  // ── 정책은 실패 신호가 아니라 **연산**이 정한다 (r9) ────────────────────────
  //   · 추가·교체(`put`)  → degrade-open. 이번 프로세스는 새 값으로 동작하고 **옛 키를 남긴다**.
  //                        재시작하면 직전 정상 상태로 돌아갈 뿐이라 잃는 것이 없다.
  //   · 해제(`revoke`)    → **fail-closed.** 진행하면 secret 은 지워지는데 grant 는 디스크에
  //                        남고, session grant 는 cookie 까지 남아 **사용자가 끊은 연결이
  //                        재시작 후 되살아난다.** 그래서 해제는 실패로 돌린다.
  save(records: Record<string, Grant>): boolean
}

// 메모리 전용 구현 — **현재 소비자는 테스트뿐이다**(0190 전수 확인). "영속 없이도 앱은 뜬다"
// 경로는 이것이 아니라 `store-file.ts` 의 자체 폴백이 맡는다(파일을 못 열면 그 안에서 메모리로
// 내려앉는다). 여기 두는 것은 production `AuthStore` 를 실제 경로 그대로 세우기 위해서다.
export function createMemoryGrantPersistence(
  seed: Record<string, Grant> = {}
): GrantPersistencePort {
  let records = { ...seed }
  return {
    // 메모리 구현은 자기가 가진 것이 전부다 — 읽기 실패라는 상태가 없다.
    load: () => ({ records: { ...records }, authoritative: true }),
    save: (next) => {
      records = { ...next }
      // 메모리 전용이지만 "이 구현이 약속한 만큼은 저장됐다" 가 참이다 — 테스트가 정상 경로를
      // degraded 경로로 오인하지 않도록 `true` 를 준다. 진짜 degraded 는 production adapter 가
      // 파일을 못 열었을 때만 나온다.
      return true
    }
  }
}

// 해제 결과 3분기 (r9). `absent`(원래 없었다)와 `failed`(영속이 성립하지 않았다)를 같은
// `undefined` 로 합치면 호출부가 실패를 "조용한 no-op" 으로 읽는다.
export type RevokeOutcome =
  { kind: 'revoked'; grant: Grant } | { kind: 'absent' } | { kind: 'failed' }

export interface AuthStoreDeps {
  persistence: GrantPersistencePort
  vault: Vault
  clock?: () => number
  // 선언에 없는 id 를 만났을 때의 통지. 삭제하지 않고 로그만 남긴다(§파생 UX 고아 grant).
  onOrphan?: (authId: AuthId) => void
  // grant 저장소를 끝까지 읽지 못해 vault 고아 sweep 을 건너뛴 경우의 진단(r9).
  onSweepSkipped?: () => void
  // 해제가 내구적으로 성립한 뒤 vault 정리만 실패한 경우의 진단(r10). 해제 자체는 되돌리지
  // 않으므로 오류가 아니라 위생 통지다.
  onVaultCleanupFailed?: (authId: AuthId, error: unknown) => void
}

// authId 하나가 이번 실행에서 갖는 상태 **전부** (0190 — 네 자료구조를 접었다).
//
// 0188 은 이것을 `Map<grant>` + `Set<verified>` + `Map<revision>` + `Set<expirySettled>` 네
// 벌로 들고, mutator 다섯이 **직접 쓰기 18곳**으로 손수 동기화했다. 같은 authId 를 두고 네 곳을
// 매번 같이 고쳐야 하는데 그것을 강제하는 것이 아무것도 없어, 한 곳을 빠뜨리면 조용히 어긋났다 —
// r3(만료 정착이 revision 을 건너뜀)·r6(정착 기준이 두 벌)이 정확히 그 형태였다.
//
// 이제 축이 하나다. 전이는 이 객체 하나를 고치는 일이고, 빠뜨릴 두 번째 자리가 없다.
interface AuthEntry {
  // 없을 수 있다 — 해제된 authId 는 **항목은 남기고 grant 만 잃는다**(아래 `revoke`).
  grant?: Grant
  // **이번 실행에서 실제 인증을 거쳤는가.** 프로세스 수명 한정 — 영속하지 않는다.
  //
  // grant 는 *기록*이고 인증이 아니다. 특히 `kind:'session'` grant 는 vault 도 `expiresAt` 도
  // 없어(교환 없는 ADFS 경로) 기록만으로 영원히 `status:'valid'` 다. 게이트가 그 status 만 보던
  // 동안 한 번 로그인에 성공한 authId 는 영구히 통과했다 — 쿠키가 죽어도 마찬가지라
  // 사실상 `authBypass` 를 켠 것과 같았다(사용자 보고). 그래서 통과 근거를 *기록* 이 아니라
  // **이번 실행의 인증**으로 옮긴다. 디스크에 남기는 순간 그 영구 bypass 가 그대로 돌아온다.
  verified: boolean
  // **실행 credential 이 실제로 바뀐 횟수** (0188). 메모리 단조 — 프로세스 수명 한정이라
  // 영속하지 않는다.
  //
  // 왜 필요한가: `AuthChange` 소비자(Harness runtime config cache · Plugin tool sync)는 "지금
  // 값이 그때 값과 같은가" 를 알아야 하는데, `status` 는 같은 값으로 여러 번 돌아온다(입력 폼을
  // 열었다 닫아도 `none` 이고, probe 를 다시 돌려도 `valid` 다). revision 이 없으면 소비자는
  // 매 change 마다 무효화하거나(불필요한 network·respawn) 아무것도 안 하거나(stale token)
  // 둘 중 하나로 몰린다.
  //
  // **같은 상태를 다시 관측했다고 올리지 않는다** — commit·revoke·만료 전이·요청 실패 강등만
  // 올린다. 그 판정은 각 mutator 안에 있다.
  revision: number
  // 시간 만료를 이미 정착시켰는가. **idempotency 를 여기서 잡는다** (r3) — 구현은
  // `markExpired` 의 조기 반환에 기대고 있었는데, 그 반환이 `credentialRevision` 증가까지
  // 함께 건너뛰어 "credentialChanged:true 인데 revision 은 그대로" 인 상태를 만들었다.
  // grant 가 교체·해제·복원되면 내린다.
  expirySettled: boolean
}

export class AuthStore {
  // **authId 축의 단일 자료구조** (0190 AC10). 여기 없는 authId 는 이번 실행에서 아무 일도
  // 일어나지 않은 것이다.
  private readonly entries = new Map<string, AuthEntry>()
  private readonly persistence: GrantPersistencePort
  private readonly vault: Vault
  private readonly clock: () => number
  private readonly onOrphan?: (authId: AuthId) => void
  private readonly onSweepSkipped?: () => void
  private readonly onVaultCleanupFailed?: (authId: AuthId, error: unknown) => void

  constructor(deps: AuthStoreDeps) {
    this.persistence = deps.persistence
    this.vault = deps.vault
    this.clock = deps.clock ?? Date.now
    this.onOrphan = deps.onOrphan
    this.onSweepSkipped = deps.onSweepSkipped
    this.onVaultCleanupFailed = deps.onVaultCleanupFailed
  }

  // 부팅 복원. **선언에 없는 id 는 조용히 무시하고 로그만 남긴다** — 삭제하지 않는다.
  // 선언이 일시적으로 빠진 빌드에서 재로그인을 강요하지 않기 위함이다.
  // 복원된 grant 는 **`verified` 가 아니다** — 기록이 살아 있다는 것과 지금 인증돼 있다는 것은
  // 다르다. 게이트를 열려면 이번 실행에서 로그인을 한 번 거쳐야 한다.
  restore(declaredIds: readonly AuthId[]): void {
    const known = new Set(declaredIds)
    // 복원은 부팅 1회이고 구독자가 붙기 전이다 — 네 축이 한 항목에 살므로 한 번에 비운다.
    // (세대도 함께 초기화된다. 이전 실행의 세대를 물려주면 소비자가 없던 변화를 본다.)
    this.entries.clear()
    const loaded = this.persistence.load()
    const persisted = Object.entries(loaded.records)
    for (const [authId, grant] of persisted) {
      if (!known.has(authId)) {
        this.onOrphan?.(authId)
        continue
      }
      this.entry(authId).grant = grant
    }
    // **아무 grant 도 가리키지 않는 vault 자리를 치운다** (r8).
    //
    // 자격증명 교체는 새 키에 쓰고 grant 로 포인터를 옮긴다. 그 사이에 앱이 죽으면 어느
    // 한쪽이 고아로 남는다 — 커밋 전에 죽었으면 새 키가, 커밋 후 정리 전에 죽었으면 옛 키가.
    // 둘 다 "쓰이지 않는 secret 이 디스크에 남는다" 는 같은 문제이므로 부팅에서 한 번에 쓸어낸다.
    //
    // **기준은 선언이 아니라 영속된 grant 전체다.** 선언에서 잠시 빠진 Auth 의 grant 는 위에서
    // 일부러 지우지 않는데(재로그인 강요 방지), 그 값을 여기서 지워 버리면 같은 배려가 무너진다.
    //
    // **그리고 그 "전체" 를 실제로 알 때만 돈다** (r9). grant 파일을 못 열거나 레코드를 하나라도
    // 버렸으면 빈/부분 맵이 오는데, 그것을 없음의 증거로 읽으면 **멀쩡한 secret 을 부팅 한 번에
    // 통째로 지운다**(grant 파일만 손상되고 secret 파일은 멀쩡한 경우가 정확히 그렇다).
    // 고아 정리는 미뤄도 되는 위생 작업이고, 잘못 지운 secret 은 복구되지 않는다.
    if (!loaded.authoritative) {
      this.onSweepSkipped?.()
      return
    }
    const referenced = new Set<string>()
    for (const [, grant] of persisted) for (const key of vaultKeysOf(grant)) referenced.add(key)
    for (const name of this.vault.names()) {
      if (referenced.has(name)) continue
      try {
        this.vault.delete(name)
      } catch {
        // 한 자리를 못 지워도 부팅은 계속한다 — 다음 부팅이 다시 시도한다.
      }
    }
  }

  // 쓰기 경로 전용 — 항목이 없으면 만든다. 읽기는 `this.entries.get()` 을 그대로 쓴다
  // (없는 authId 를 조회했다고 항목이 생기면 안 된다).
  private entry(authId: AuthId): AuthEntry {
    const existing = this.entries.get(authId)
    if (existing) return existing
    const created: AuthEntry = { verified: false, revision: 0, expirySettled: false }
    this.entries.set(authId, created)
    return created
  }

  // 영속에 실을 grant 맵. **grant 를 잃은 항목(해제된 authId)은 빠진다** — 세대를 남기려고
  // 항목을 유지하는 것이 디스크에 빈 자리를 만들면 안 된다.
  private records(): Record<string, Grant> {
    const records: Record<string, Grant> = {}
    for (const [authId, entry] of this.entries) {
      if (entry.grant) records[authId] = entry.grant
    }
    return records
  }

  // 실행 credential 세대. 한 번도 바뀐 적 없으면 0.
  credentialRevision(authId: AuthId): number {
    return this.entries.get(authId)?.revision ?? 0
  }

  // 이번 실행에서 인증이 확인됐는가. grant 가 없으면 당연히 거짓이다.
  isVerified(authId: AuthId): boolean {
    const entry = this.entries.get(authId)
    return entry !== undefined && entry.verified && entry.grant !== undefined
  }

  // 확인 성립. `put`(방금 로그인) 외의 유일한 진입점은 자동 로그인(`LoginService.resume`)이다.
  markVerified(authId: AuthId): void {
    const entry = this.entries.get(authId)
    if (entry?.grant) entry.verified = true
  }

  get(authId: AuthId): Grant | undefined {
    return this.entries.get(authId)?.grant
  }

  // 방금 인증에 성공한 결과가 들어온다 — 그러므로 이 grant 는 이번 실행에서 확인된 것이다.
  // **영속이 먼저, 메모리 publish 가 나중이다** (r7). 반대로 하면 `persistence.save` 가 실패했을 때
  // 메모리에는 새 secret 과 올라간 revision 이 남는데 디스크에는 없고, 호출부는 예외를 받아
  // snapshot 도 발행하지 않는다 — 재시작하면 사라질 상태를 화면과 Harness cache 가 믿게 된다.
  //
  // 내구 저장이었는지를 돌려준다 (r8) — 호출부가 옛 vault 키를 지워도 되는지 판단한다.
  put(authId: AuthId, grant: Grant): boolean {
    const durable = this.persist({ ...this.records(), [authId]: grant })
    const entry = this.entry(authId)
    entry.grant = grant
    entry.verified = true
    // 새 자격증명은 아직 만료를 정착시킨 적이 없다. 안 내리면 이 값이 나중에 자연 만료돼도
    // 이미 정착됐다고 판단해 전이를 건너뛴다 — 만료인데 화면은 연결됨으로 남는다.
    entry.expirySettled = false
    // credential commit — 실행 구성이 실제로 달라졌다.
    entry.revision += 1
    return durable
  }

  // 해제 — grant 와 vault 잔여물을 함께 지운다. secret/token 이 아닌 session grant 는
  // vault 에 값이 없으므로 cookie jar 정리는 호출부(browser session)가 맡는다.
  //
  // ── 해제는 fail-closed 다 (r9) ─────────────────────────────────────────────
  //
  // **영속이 먼저다.** r8 은 vault 를 지우고 메모리를 비운 뒤 `flush()` 의 결과를 버렸다. 그러면
  // 저장이 실패했을 때 ⓐ secret 은 사라졌는데 디스크의 grant 는 그 키를 계속 가리키고
  // ⓑ session grant 는 vault 에 값이 없어 **아무것도 사라지지 않은 채** 화면만 '해제됨' 이 된다 —
  // 재시작하면 grant 가 복원되고 cookie 가 살아 있어 probe 가 통과, **사용자가 끊은 연결이
  // 되살아난다.** 추가/교체와 달리 해제는 degrade 로 접을 수 없다.
  // ── 내구 저장 이후는 되돌아가지 않는다 (r10) ───────────────────────────────
  //
  // r9 는 `persist` 성공 뒤 `vault.delete()` 를 **가드 없이** 부르고 그 다음에야 메모리를
  // 바꿨다. `Vault.delete` 는 secret store 쓰기 3회 + index 재작성이라 던질 수 있고, 던지면
  // 디스크는 이미 해제됐는데 **이 프로세스의 grant 는 살아 있다** — 화면과 Plugin 도구는
  // 연결된 상태로 남고, 사용자는 "해제 실패" 를 본 뒤 재시작하면 해제돼 있다. `persist` 실패를
  // 성공으로 오인하던 r8 의 문제와 방향만 반대인 같은 split-brain 이다.
  //
  // 그래서 경계를 **내구 저장 하나**로 못 박는다. 저장 전이면 아무것도 바뀌지 않고, 저장
  // 후이면 vault 정리 성공 여부와 무관하게 해제가 확정된다. 남은 vault 자리는 아무 grant 도
  // 가리키지 않으므로 다음 부팅의 고아 sweep 이 치운다(그 sweep 이 다시 신뢰 가능해진 것이
  // r10 의 `authoritative` 수정이다).
  revoke(authId: AuthId): RevokeOutcome {
    const entry = this.entries.get(authId)
    const grant = entry?.grant
    if (!entry || !grant) return { kind: 'absent' }
    const next = this.records()
    delete next[authId]
    // 저장이 성립하지 않으면 **아무것도 건드리지 않고** 실패로 돌린다(r9 fail-closed 유지).
    if (!this.persist(next)) return { kind: 'failed' }
    // 여기부터는 best-effort 다 — 실패해도 해제를 되돌리지 않는다.
    this.deleteVaultKeys(authId, grant)
    // ── 항목은 남기고 grant 만 지운다 (0190) ──────────────────────────────────
    //
    // 네 자료구조를 한 항목으로 접으면서 해제를 `entries.delete(authId)` 로 옮기고 싶어지는데,
    // 그러면 **세대가 0 으로 되돌아간다.** revision 은 프로세스 수명 동안 단조여야 한다 —
    // `AuthChange` 소비자는 "그때 값과 지금 값이 같은가" 를 이 숫자로만 판정하므로, 해제 전 1 과
    // 재로그인 후 1 을 **같은 세대로 읽는다.** 죽은 토큰으로 만든 실행 구성이 warm hit 로 계속
    // 돌아오고, Plugin 도구는 회수된 채로 남는다.
    //
    // 그래서 grant 만 비우고 항목은 남긴다. 영속에는 `records()` 가 grant 없는 항목을 빼므로
    // 디스크에 빈 자리가 생기지 않는다.
    entry.grant = undefined
    entry.verified = false
    entry.expirySettled = false
    entry.revision += 1
    return { kind: 'revoked', grant }
  }

  private deleteVaultKeys(authId: AuthId, grant: Grant): void {
    for (const key of vaultKeysOf(grant)) {
      try {
        this.vault.delete(key)
      } catch (error) {
        // 고아로 남는다. 지워지지 않은 값이 살아 있어도 그것을 가리키는 grant 가 없으므로
        // 인증에 쓰이지 않는다 — 위생 문제이지 접근 문제가 아니다.
        this.onVaultCleanupFailed?.(authId, error)
      }
    }
  }

  // 만료된 토큰을 `expired` 로 강등한다(요청 실패 관측 또는 `expiresAt` 경과). grant 자체는 남긴다 —
  // 사용자가 어느 provider 를 다시 인증해야 하는지 화면에서 봐야 한다.
  status(authId: AuthId): AuthStatus {
    const grant = this.entries.get(authId)?.grant
    if (!grant) return 'none'
    const expired = grant.expiresAt !== undefined && grant.expiresAt <= this.clock()
    if (grant.kind === 'session') return expired ? 'expired' : 'valid'
    const read = this.vault.read(grant.vaultKey)
    if (read.state === 'undecryptable') return 'unknown'
    if (read.state === 'absent') return 'none'
    return expired ? 'expired' : 'valid'
  }

  // 요청 실패 관측 시 강등. **grant 를 지우지 않는다** — 사용자가 어느 provider 를 다시 인증해야
  // 하는지 화면에서 봐야 하고, 재인증이 기존 항목을 교체하는 형태여야 하기 때문이다.
  //
  // 돌려주는 값은 **이번 호출이 무엇을 바꿨는가** 다 (r4 → r5 에서 두 축으로 분리).
  //
  //   `credentialChanged` — 실행 credential 이 달라졌는가(= revision 을 올렸는가).
  //                         Harness cache 무효화·Plugin 도구 재sync 가 여기에 걸린다.
  //   `snapshotChanged`   — 밖에서 보이는 상태가 하나라도 달라졌는가.
  //                         `verified` 만 풀린 경우가 여기 해당한다 — 화면은 갱신돼야 하지만
  //                         실행 구성은 그대로다.
  //
  // 둘을 가른 이유: r4 는 boolean 하나였고 호출부가 "전이 없음" 을 곧 "알릴 것 없음" 으로도,
  // "credentialChanged:false 로 알림" 으로도 읽을 수 있었다. **둘 다 false 면 방송 자체를
  // 하지 않는다** — 같은 401 을 동시 요청 두 건이 각각 봐도 상태는 한 번만 달라지는데,
  // r4 는 두 번째에도 GUI 방송을 한 번 더 냈다.
  //
  // `observedRevision` 을 주면 **그 세대의 자격증명에 대한 관측일 때만** 강등한다 (r8). 401 은
  // 요청을 보낸 그 값에 대한 서버 판정이다 — 요청이 도는 사이 사용자가 재인증했다면 그 판정은
  // 이미 존재하지 않는 값에 대한 것이고, 새 값을 내리는 근거가 될 수 없다. 세대를 안 보면 방금
  // 성공한 로그인이 옛 요청의 401 로 곧바로 `expired` 가 된다(부팅 복원 probe 에서 실측됨).
  markExpired(
    authId: AuthId,
    observedRevision?: number
  ): { credentialChanged: boolean; snapshotChanged: boolean } {
    const entry = this.entries.get(authId)
    const grant = entry?.grant
    if (!entry || !grant) return { credentialChanged: false, snapshotChanged: false }
    if (observedRevision !== undefined && entry.revision !== observedRevision) {
      return { credentialChanged: false, snapshotChanged: false }
    }
    // 확인은 무조건 취소한다 — 401 을 봤는데 "확인됨" 을 남겨 두면 게이트가 열린 채로 남는다.
    // (아래 조기 반환보다 앞이어야 한다: 이미 만료 표기된 grant 도 확인은 풀려야 한다.)
    const unverified = entry.verified
    entry.verified = false
    // **중복 판정의 기준은 정착 집합이지 `expiresAt` 비교가 아니다** (r6). r5 는 `expiresAt <= now`
    // 만 보고 "이미 정착됨" 으로 접었는데, 그러면 **요청이 도는 동안 시계가 지나 만료된** 경우가
    // 통째로 빠진다 — 요청 시작 때는 valid 라 `settleExpiry` 가 지나갔고, 401 이 왔을 때는
    // `expiresAt <= now` 라 여기서도 접혀서, 전이가 다음 `snapshot()` 까지 미뤄졌다.
    // 두 정착 지점(`settleExpiry`·여기)이 같은 집합 하나를 기준으로 삼아야 1회성이 성립한다.
    if (entry.expirySettled) {
      if (unverified) this.flush()
      return { credentialChanged: false, snapshotChanged: unverified }
    }
    const now = this.clock()
    // 아직 만료 시각이 없거나 미래면 지금으로 못 박는다. 이미 시계상 지났으면 그 값을 유지한다 —
    // 만료 시점을 뒤로 미루면 표시가 거짓말이 된다.
    if (grant.expiresAt === undefined || grant.expiresAt > now) {
      entry.grant = { ...grant, expiresAt: now }
    }
    this.settleExpired(entry)
    return { credentialChanged: true, snapshotChanged: true }
  }

  // 만료 정착의 **공통 꼬리** (0190 S5). 같은 전이를 두 입구가 낸다 — `markExpired`(요청 실패 관측)와
  // `settleExpiry`(시계 경과). 꼬리를 두 벌로 적으면 한쪽만 고쳐지고, 그때 무엇이 어긋나는지는
  // 0188 이 두 라운드로 배웠다: r3 은 정착이 revision 증가를 건너뛰어 `credentialChanged:true`
  // 를 받은 소비자가 세대로는 아무 변화도 못 봤고, r6 은 정착 판정 기준 자체가 두 벌이라
  // 요청이 도는 사이 만료된 경우가 양쪽에서 접혀 전이가 통째로 사라졌다.
  private settleExpired(entry: AuthEntry): void {
    entry.expirySettled = true
    entry.verified = false
    entry.revision += 1
    this.flush()
  }

  // ── 재인증은 되돌리지 않는다 — 애초에 나가지 않는다 (0188 D-009 → r5 D-047) ──
  //
  // r4 까지는 `captureForRollback`/`rollback` 이 있었다. 재인증이 후보 grant 를 **전역 store 와
  // vault 에 먼저 커밋한 뒤** probe 했기 때문이다 — 실패하면 되돌려야 했다.
  //
  // 그 되돌림은 원리적으로 불완전했다. ① probe 왕복 동안 다른 소비자가 검증되지 않은 후보
  // secret 과 올라간 revision 을 읽었다 ② 후보의 401 이 강등 이벤트를 냈고, 상태는 되돌아가도
  // **이미 나간 이벤트는 취소되지 않아** Plugin 도구가 회수된 채로 남았다 ③ 좌표 목록에
  // `expirySettled` 가 빠져 있어, 되살린 grant 가 나중에 자연 만료돼도 `settleExpiry` 가 이미
  // 정착됐다고 판단해 전이를 건너뛰었다(만료인데 `verified:true`) ④ probe 중 앱이 죽으면
  // 후보 값이 vault 에 남았다.
  //
  // r5 는 되돌림을 고치지 않고 **없앴다** — 확인이 끝날 때까지 후보를 어디에도 쓰지 않는다
  // (`AuthenticatedRequester`의 `CandidateCredential`). 커밋은 성공 후 한 번뿐이라 되돌릴 중간
  // 상태가 생기지 않는다. 위 네 결함이 함께 사라진다.

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
    const entry = this.entries.get(authId)
    const grant = entry?.grant
    if (!entry || !grant) return false
    if (grant.expiresAt === undefined || grant.expiresAt > this.clock()) return false
    // **첫 관측에서만** 전이한다. r2 는 이 판정을 `markExpired` 의 조기 반환에 맡겼는데, 그
    // 반환이 revision 증가까지 함께 건너뛰어 `credentialChanged:true` 를 받은 소비자가
    // revision 으로는 아무 변화도 보지 못했다 — revision 이 존재하는 이유가 바로 그 판정이다.
    if (entry.expirySettled) return false
    this.settleExpired(entry)
    return true
  }

  authKind(authId: AuthId): AuthMethodKind | null {
    return this.entries.get(authId)?.grant?.authKind ?? null
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
    return this.entries.get(authId)?.grant === expected
  }

  // 값형용 — identity + 만료. 변경 전 `secret()` 이 홉마다 만료를 다시 봤다.
  // **vault 존재·복호화 가능성은 보지 않는다** — 그쪽은 요청당 1회 snapshot 과 맞바꾼 부분이라
  // 이름을 `usable` 이 아니라 `currentUnexpired` 로 둔다.
  isCurrentUnexpiredGrant(authId: AuthId, expected: Grant): boolean {
    const current = this.entries.get(authId)?.grant
    if (current !== expected) return false
    return current.expiresAt === undefined || current.expiresAt > this.clock()
  }

  // refresh token 값 (0194). **`grant.expiresAt` 을 보지 않는다** — access token 이 만료된
  // 바로 그 순간이 이 값을 쓰는 때다. 보는 것은 refresh 자신의 만료(`refreshExpiresAt`)뿐이고,
  // 그것이 없으면 "모른다" 라서 값을 준다(D-009 — 시도하고 실패로 판정한다).
  //
  // `secret()` 과 합치지 않는 이유가 이것이다: 두 값은 만료 판정 기준이 다르다.
  refreshSecret(authId: AuthId): string | null {
    const grant = this.entries.get(authId)?.grant
    if (!grant || grant.kind !== 'token' || grant.refreshKey === undefined) return null
    if (grant.refreshExpiresAt !== undefined && grant.refreshExpiresAt <= this.clock()) return null
    const read = this.vault.read(grant.refreshKey)
    return read.state === 'found' ? read.value : null
  }

  // 유효할 때만 값을 준다 — 만료·복호화 실패 상태의 값을 요청에 싣지 않는다.
  //
  // `status()` 를 부르고 vault 를 또 읽지 않는다. `SecretStore.get` 은 호출마다 파일을
  // 다시 읽고 복호화하므로(캐시 없음) 두 번 물으면 턴마다 그 값을 두 번 낸다 —
  // `status()` 의 값형 판정은 곧 `read.state === 'found' && !expired` 라, 한 번 읽어 둘 다 답한다.
  secret(authId: AuthId): string | null {
    const grant = this.entries.get(authId)?.grant
    if (!grant || grant.kind === 'session') return null
    if (grant.expiresAt !== undefined && grant.expiresAt <= this.clock()) return null
    const read = this.vault.read(grant.vaultKey)
    return read.state === 'found' ? read.value : null
  }

  private flush(): void {
    this.persist(this.records())
  }

  // 포트의 실패 신호를 **하나로 정규화한다** (r9). 구현이 던지든 `false` 를 주든 호출부가 보는
  // 것은 boolean 하나다 — r8 은 두 신호에 서로 다른 정책을 붙여, 같은 "내구 저장 실패" 가
  // 로그인에서는 거부로 vault 경로에서는 degrade 로 갈라졌다.
  private persist(records: Record<string, Grant>): boolean {
    try {
      return this.persistence.save(records)
    } catch {
      return false
    }
  }
}
