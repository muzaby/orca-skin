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
