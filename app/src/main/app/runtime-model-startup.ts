import type { AuthChange, AuthId, AuthRuntime, AuthSnapshot } from '../contracts/auth'
import type {
  RuntimeModelCatalog,
  RuntimeModelCatalogBridge,
  RuntimeModelContribution
} from '../features/harnesses/runtime-catalog'
import { canonicalAgentKey } from '../features/harnesses/models'

export function affectedRuntimeModelAuthIds(
  keys: Iterable<string>,
  contributions: readonly RuntimeModelContribution[]
): AuthId[] {
  const canonicalKeys = new Set([...keys].map(canonicalAgentKey))
  return [
    ...new Set(
      contributions
        .filter((item) => canonicalKeys.has(canonicalAgentKey(item.key)))
        .map((item) => item.authId)
    )
  ]
}

export function invalidateRuntimeModelsForAuth(input: {
  keys: Iterable<string>
  contributions: readonly RuntimeModelContribution[]
  invalidate(key: string): void
  snapshotOf(authId: AuthId): AuthSnapshot
  reconcile(authId: AuthId, snapshot: AuthSnapshot): void
}): void {
  const keys = [...input.keys]
  for (const key of keys) input.invalidate(key)
  for (const authId of affectedRuntimeModelAuthIds(keys, input.contributions)) {
    input.reconcile(authId, input.snapshotOf(authId))
  }
}

export function createRuntimeModelAuthInvalidator(input: {
  invalidatedKeys: Readonly<Partial<Record<AuthId, readonly string[]>>>
  contributions: readonly RuntimeModelContribution[]
  invalidate(key: string): void
  snapshotOf(authId: AuthId): AuthSnapshot
  reconcile(authId: AuthId, snapshot: AuthSnapshot): void
}): (authId: AuthId) => void {
  return (authId) => {
    const keys = new Set([
      ...(input.invalidatedKeys[authId] ?? []),
      ...input.contributions.filter((item) => item.authId === authId).map((item) => item.key)
    ])
    invalidateRuntimeModelsForAuth({
      keys,
      contributions: input.contributions,
      invalidate: input.invalidate,
      snapshotOf: input.snapshotOf,
      reconcile: input.reconcile
    })
  }
}

// 카탈로그 재조정 축이 읽는 **살아 있는** auth snapshot. 컴포지션 루트가 같은 식을 seam 마다
// 손으로 적으면(0202 r1 은 `bootstrap.ts` 에 4벌이었다) 한 벌이 조용히 굳은 값·빈 값으로 바뀌어도
// 부재가 아니라 **무동작**이라 typecheck 가 잡지 못한다. 여기 한 곳으로 모아 단위로 잠근다.
export function createRuntimeModelSnapshotReader(
  auth: Pick<AuthRuntime, 'bind'>
): (authId: AuthId) => AuthSnapshot {
  return (authId) => auth.bind(authId).snapshot()
}

// 복원 batch 가 자기 probe 로 만든 `verified` 전이를 카탈로그 재조정에 잇는 sink (0202 D-008).
// **호출 시점에 snapshot 을 읽는다** — 생성 시점 값을 캡처하면 두 번째 통지가 낡은 상태를 싣는다.
export function createRuntimeModelReconcileVerified(input: {
  bridge: Pick<RuntimeModelCatalogBridge, 'onSnapshot'>
  snapshotOf: (authId: AuthId) => AuthSnapshot
}): (authId: AuthId) => void {
  return (authId) => {
    void input.bridge.onSnapshot(authId, input.snapshotOf(authId))
  }
}

// 이미 손에 든 snapshot 을 카탈로그 재조정으로 넘기는 sink. `createRuntimeModelReconcileVerified`
// 와 달리 snapshot 을 읽지 않는다 — Auth 이벤트가 실어 온 값이 그대로 정본이다.
export function createRuntimeModelReconcileSnapshot(
  bridge: Pick<RuntimeModelCatalogBridge, 'onSnapshot'>
): (authId: AuthId, snapshot: AuthSnapshot) => void {
  return (authId, snapshot) => {
    void bridge.onSnapshot(authId, snapshot)
  }
}

// `AuthChange` 하나가 지나는 네 갈래 — 화면 방송 · plugin 동기화 · harness 무효화 · 카탈로그
// 재조정. 컴포지션 루트의 클로저로 두면 어느 갈래가 사라져도 게이트가 조용하다(0202 D4).
export function createRuntimeModelAuthChangeHandler(input: {
  pushConnectionState(): void
  syncPlugins(authId: AuthId): void
  invalidateForAuth(authId: AuthId): void
  reconcileSnapshot(authId: AuthId, snapshot: AuthSnapshot): void
}): (change: AuthChange) => void {
  return (change) => {
    input.pushConnectionState()
    // 화면 변화(입력 폼·OAuth 대기·resuming)는 여기서 끝난다 — 실행 credential 이 그대로다.
    if (change.kind !== 'snapshot') return
    if (change.credentialChanged) {
      input.syncPlugins(change.authId)
      input.invalidateForAuth(change.authId)
    }
    input.reconcileSnapshot(change.authId, change.snapshot)
  }
}

export function createRuntimeModelAuthResume(input: {
  auth: Pick<AuthRuntime, 'subscribe'>
  onChange(change: AuthChange): void
  onGateChange(authId: AuthId): void
  run(): void
}): () => void {
  return () => {
    input.auth.subscribe(input.onChange)
    input.auth.subscribe((change) => {
      if (change.kind === 'snapshot') input.onGateChange(change.authId)
    })
    input.run()
  }
}

export async function startRuntimeModelCatalogAfterDeploy(input: {
  invalidateSettings(): void
  invalidateRuntime(): void
  catalog: RuntimeModelCatalog
  bridge: RuntimeModelCatalogBridge
  resumeAuth(): void
}): Promise<void> {
  input.invalidateSettings()
  input.invalidateRuntime()
  await input.catalog.invalidate()
  await input.bridge.attach(input.catalog)
  input.resumeAuth()
}
