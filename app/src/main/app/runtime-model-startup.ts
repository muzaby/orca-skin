import type { AuthId } from '../contracts/auth'
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

export async function startRuntimeModelCatalogAfterDeploy(input: {
  invalidateSettings(): void
  invalidateRuntime(): void
  catalog: RuntimeModelCatalog
  bridge: RuntimeModelCatalogBridge
  resumeAuth(): void
}): Promise<void> {
  input.invalidateSettings()
  input.invalidateRuntime()
  input.catalog.invalidate()
  await input.bridge.attach(input.catalog)
  input.resumeAuth()
}
