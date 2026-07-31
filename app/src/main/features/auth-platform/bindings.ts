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
// 영속: **하지 않는다.** 인증 상태는 매 앱 실행마다 restore/재로그인부터 시작하는 현행 SSO 동작을
// 승계한다. 영속이 필요해지면 여기서만 바꾸면 된다.

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

export class BindingStore {
  private readonly bindings = new Map<string, AuthBindingInfo>()
  private seq = 0

  constructor(private readonly clock: () => number = Date.now) {}

  create(input: CreateBindingInput): AuthBindingInfo {
    const id = `bind_${++this.seq}_${Math.random().toString(36).slice(2, 10)}`
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
    return next
  }

  // 이 binding 에 종속된 것들(재귀). cascade 판정용.
  dependentsOf(id: string): AuthBindingInfo[] {
    const direct = this.list().filter((b) => b.parentBindingId === id)
    return direct.flatMap((child) => [child, ...this.dependentsOf(child.id)])
  }

  // cascade=false 면 이 binding 만, true 면 종속까지. 제거된 id 목록을 돌려준다 —
  // 호출부(broker)가 그 목록으로 vault·session 정리를 수행한다.
  remove(id: string, cascade: boolean): string[] {
    const target = this.bindings.get(id)
    if (!target) return []
    const victims = cascade ? [target, ...this.dependentsOf(id)] : [target]
    for (const v of victims) this.bindings.delete(v.id)
    return victims.map((v) => v.id)
  }

  clear(): void {
    this.bindings.clear()
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
