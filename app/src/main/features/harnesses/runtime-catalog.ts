import type { AgentEnvironment } from '../../../shared/ipc'
import type { AuthId, AuthSnapshot } from '../../contracts/auth'
import type { HarnessRuntimeConfigService } from './runtime-config'
import { availableModelsOf, normalizeAvailableModels } from './claude/available-models'
import { canonicalAgentKey } from './models'

export interface RuntimeModelContribution {
  authId: AuthId
  key: string
  harnessId: string
  modelProviderId: string
}

export interface RuntimeModelCatalog {
  list(): AgentEnvironment[]
  isReadOnly(key: string): boolean
  invalidate(key?: string): void
  reconcile(authId: AuthId, snapshot: AuthSnapshot): Promise<void>
}

export interface RuntimeModelCatalogBridge {
  onSnapshot(authId: AuthId, snapshot: AuthSnapshot): Promise<void>
  attach(catalog: RuntimeModelCatalog): Promise<void>
}

export function createRuntimeModelCatalogBridge(input: {
  contributions: readonly RuntimeModelContribution[]
  snapshotOf: (authId: AuthId) => AuthSnapshot
}): RuntimeModelCatalogBridge {
  let catalog: RuntimeModelCatalog | undefined
  const latest = new Map<AuthId, AuthSnapshot>()

  return {
    async onSnapshot(authId, snapshot) {
      latest.set(authId, snapshot)
      await catalog?.reconcile(authId, snapshot)
    },
    async attach(next) {
      catalog = next
      const authIds = new Set(input.contributions.map((contribution) => contribution.authId))
      await Promise.all(
        [...authIds].map((authId) =>
          next.reconcile(authId, latest.get(authId) ?? input.snapshotOf(authId))
        )
      )
    }
  }
}

export function createRuntimeModelCatalog(input: {
  contributions: readonly RuntimeModelContribution[]
  runtime: HarnessRuntimeConfigService
  onChange?: () => void
}): RuntimeModelCatalog {
  const entries = new Map<string, AgentEnvironment>()
  const authGeneration = new Map<AuthId, number>()
  const resolvedRevision = new Map<string, number>()
  const inFlight = new Map<string, Promise<void>>()

  const removeForAuth = (authId: AuthId): void => {
    let changed = false
    for (const contribution of input.contributions) {
      if (contribution.authId !== authId) continue
      resolvedRevision.delete(contribution.key)
      if (entries.delete(canonicalAgentKey(contribution.key))) changed = true
    }
    if (changed) input.onChange?.()
  }

  const reconcile = async (authId: AuthId, snapshot: AuthSnapshot): Promise<void> => {
    const contributions = input.contributions.filter((item) => item.authId === authId)
    if (contributions.length === 0) return
    if (!snapshot.verified || snapshot.status !== 'valid') {
      authGeneration.set(authId, (authGeneration.get(authId) ?? 0) + 1)
      removeForAuth(authId)
      return
    }

    const generation = authGeneration.get(authId) ?? 0
    await Promise.all(
      contributions.map(async (contribution) => {
        if (resolvedRevision.get(contribution.key) === snapshot.credentialRevision) return
        const pending = inFlight.get(contribution.key)
        if (pending) return pending
        const work = (async (): Promise<void> => {
          try {
            const config = await input.runtime.resolve(contribution)
            if ((authGeneration.get(authId) ?? 0) !== generation) return
            const availableModels = availableModelsOf(config)
            const models = normalizeAvailableModels(availableModels ?? [])
            const next =
              models.length === 0
                ? undefined
                : {
                    key: contribution.key,
                    adapter: contribution.harnessId,
                    provider: contribution.modelProviderId,
                    models,
                    supported: true,
                    source: 'runtime' as const,
                    readOnly: true
                  }
            const key = canonicalAgentKey(contribution.key)
            const previous = entries.get(key)
            if (next) entries.set(key, next)
            else entries.delete(key)
            resolvedRevision.set(contribution.key, snapshot.credentialRevision)
            if (previous !== next) input.onChange?.()
          } catch {
            if ((authGeneration.get(authId) ?? 0) !== generation) return
            resolvedRevision.delete(contribution.key)
            if (entries.delete(canonicalAgentKey(contribution.key))) input.onChange?.()
          } finally {
            inFlight.delete(contribution.key)
          }
        })()
        inFlight.set(contribution.key, work)
        return work
      })
    )
  }

  return {
    list: () => [...entries.values()].sort((a, b) => a.key.localeCompare(b.key)),
    isReadOnly: (key) =>
      input.contributions.some(
        (contribution) => canonicalAgentKey(contribution.key) === canonicalAgentKey(key)
      ),
    invalidate(key) {
      const targets = key
        ? input.contributions.filter(
            (contribution) => canonicalAgentKey(contribution.key) === canonicalAgentKey(key)
          )
        : input.contributions
      for (const authId of new Set(targets.map((contribution) => contribution.authId))) {
        authGeneration.set(authId, (authGeneration.get(authId) ?? 0) + 1)
      }
      let changed = false
      for (const contribution of targets) {
        resolvedRevision.delete(contribution.key)
        if (entries.delete(canonicalAgentKey(contribution.key))) changed = true
      }
      if (changed) input.onChange?.()
    },
    reconcile
  }
}
