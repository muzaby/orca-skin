// Binding 스토어 (0157) — 인증 결과의 소유자.
//
// binding 은 "이 대상(target)이 이 provider 로 인증됐다"는 **불투명 레코드**다. 실제 secret 과
// cookie jar 는 vault·session store 가 소유하고 여기에는 handle 만 남는다 (AUTH-PLAT-008).
//
// 핵심 책임은 **logout 의존성**이다 (AUTH-PLAT-010):
//   - 앱 로그인 binding 에 종속된 서비스 binding 은 `parentBindingId` 로 연결된다.
//   - connector 하나의 연결 해제는 그 binding 만 끊는다 — 공유 session group 을 통째로
//     삭제하지 않는다.
//   - 앱 로그아웃은 cascade 로 종속 binding 까지 끊는다.
//
// 영속: **선택 주입이다** (0170). 기본은 메모리 전용이고, 컴포지션 루트가 `BindingPersistence`
// 를 주면 레코드가 디스크에 남아 재시작 후 복원된다(사용자 요청 2026-08-05 — "재시작시 인증정보를
// 다시 입력하고 연결해야함"). 0157 은 "현행 SSO 동작을 승계한다" 며 영속하지 않았는데, 승계
// 대상이던 SSO 는 그 핸드오프가 전량 제거해 근거가 사라졌다.
//
// **여기 남는 것은 비밀이 아니다.** 값은 vault(safeStorage)에만 있고 이 레코드는 handle 만 든다.
// 네임스페이스가 `authBindingPrefix(binding.id)` 라, id 를 영속하는 것이 곧 **비밀을 다시 찾는
// 열쇠**다 — 그래서 vault 계약을 하나도 건드리지 않는다.

import type {
  AuthBindingInfo,
  AuthBindingStatus,
  AuthMechanism,
  AuthArtifactRef,
  AuthPrincipal,
  AuthTarget
} from '../../../shared/ipc'

export interface CreateBindingInput {
  pluginId: string
  providerId: string
  target: AuthTarget
  mechanism: AuthMechanism
  artifact: AuthArtifactRef
  principal?: AuthPrincipal
  parentBindingId?: string
  expiresAt?: number
}

// 레코드 영속 포트. 구현은 infra 에 있고(electron-store) 여기는 형상만 안다 — features 는
// infra 를 알아도 되지만, 파일 형식까지 알면 이 파일이 테스트하기 어려워진다.
export interface BindingPersistence {
  load(): AuthBindingInfo[]
  save(records: readonly AuthBindingInfo[]): void
}

export class BindingStore {
  private readonly bindings = new Map<string, AuthBindingInfo>()
  private seq = 0

  constructor(
    private readonly clock: () => number = Date.now,
    private readonly persistence?: BindingPersistence
  ) {}

  // 저장된 레코드를 그대로 메모리에 올린다. **검증은 하지 않는다** — 비밀이 아직 있는지,
  // 어떤 target 을 되살릴지는 vault 를 아는 broker 가 판단한다(`AuthBroker.restore`).
  loadPersisted(): AuthBindingInfo[] {
    if (!this.persistence) return []
    return this.persistence.load()
  }

  // 복원 결과를 확정한다 — broker 가 걸러낸 목록으로 메모리와 저장소를 **함께** 맞춘다.
  // 폐기된 레코드가 파일에 남으면 다음 부팅에 또 되살아난다.
  adopt(records: readonly AuthBindingInfo[]): void {
    this.bindings.clear()
    for (const record of records) this.bindings.set(record.id, record)
    this.flush()
  }

  // 레코드를 바꾸는 **모든** 경로가 여기로 모인다. 경로마다 저장을 흩뿌리면 하나를 빠뜨리는
  // 순간 메모리와 파일이 조용히 어긋난다.
  private flush(): void {
    this.persistence?.save(this.list())
  }

  create(input: CreateBindingInput): AuthBindingInfo {
    // 복원된 레코드와 겹치지 않을 때까지 뽑는다. 겹치면 새 binding 이 남의 vault 네임스페이스를
    // 물려받는다 — 랜덤 접미사로 사실상 일어나지 않지만, 대가가 자격증명 오배정이라 막아 둔다.
    let id = `bind_${++this.seq}_${Math.random().toString(36).slice(2, 10)}`
    while (this.bindings.has(id))
      id = `bind_${++this.seq}_${Math.random().toString(36).slice(2, 10)}`
    const binding: AuthBindingInfo = {
      id,
      pluginId: input.pluginId,
      providerId: input.providerId,
      target: input.target,
      mechanism: input.mechanism,
      artifact: input.artifact,
      status: 'valid',
      createdAt: this.clock(),
      ...(input.principal !== undefined ? { principal: input.principal } : {}),
      ...(input.parentBindingId !== undefined ? { parentBindingId: input.parentBindingId } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {})
    }
    // 같은 target 에 대한 기존 binding 은 교체한다 — 한 대상에 두 인증이 공존하면 어느 것이
    // 쓰이는지 모호해진다.
    const existing = this.findByTarget(input.target)
    if (existing) this.bindings.delete(existing.id)
    this.bindings.set(id, binding)
    this.flush()
    return binding
  }

  get(id: string): AuthBindingInfo | undefined {
    return this.bindings.get(id)
  }

  list(): AuthBindingInfo[] {
    return [...this.bindings.values()]
  }

  findByTarget(target: AuthTarget): AuthBindingInfo | undefined {
    return this.list().find((b) => sameTarget(b.target, target))
  }

  // application target 의 root binding — 게이트 판정과 cascade 의 기준점.
  findApplicationBinding(): AuthBindingInfo | undefined {
    return this.list().find((b) => b.target.kind === 'application')
  }

  setStatus(id: string, status: AuthBindingStatus): AuthBindingInfo | undefined {
    const binding = this.bindings.get(id)
    if (!binding) return undefined
    const next = { ...binding, status }
    this.bindings.set(id, next)
    this.flush()
    return next
  }

  patch(
    id: string,
    patch: Partial<Pick<AuthBindingInfo, 'status' | 'expiresAt' | 'principal'>>
  ): AuthBindingInfo | undefined {
    const binding = this.bindings.get(id)
    if (!binding) return undefined
    const next: AuthBindingInfo = { ...binding, ...patch }
    this.bindings.set(id, next)
    this.flush()
    return next
  }

  // 이 binding 에 종속된 것들(재귀). cascade 판정용.
  dependentsOf(id: string): AuthBindingInfo[] {
    const direct = this.list().filter((b) => b.parentBindingId === id)
    return direct.flatMap((child) => [child, ...this.dependentsOf(child.id)])
  }

  // cascade=false 면 이 binding 만, true 면 종속까지. 제거된 id 목록을 돌려준다 —
  // 호출부(broker)가 그 목록으로 vault·session 정리를 수행한다.
  takeForRemoval(id: string, cascade: boolean): AuthBindingInfo[] {
    const target = this.bindings.get(id)
    if (!target) return []
    const victims = cascade ? [target, ...this.dependentsOf(id)] : [target]
    for (const v of victims) this.bindings.delete(v.id)
    this.flush()
    return victims
  }

  remove(id: string, cascade: boolean): string[] {
    return this.takeForRemoval(id, cascade).map((binding) => binding.id)
  }

  clear(): void {
    this.bindings.clear()
    this.flush()
  }
}

export function sameTarget(a: AuthTarget, b: AuthTarget): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'application' && b.kind === 'application')
    return a.applicationId === b.applicationId
  if (a.kind === 'connector' && b.kind === 'connector') {
    return a.connectorId === b.connectorId && a.connectionId === b.connectionId
  }
  return false
}

// transaction 키 — `(providerId, target)` 당 1건 제한에 쓰인다.
export function targetKey(target: AuthTarget): string {
  return target.kind === 'application'
    ? `application:${target.applicationId}`
    : `connector:${target.connectorId}:${target.connectionId}`
}
