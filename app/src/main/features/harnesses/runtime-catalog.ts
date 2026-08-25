import type { AgentEnvironment } from '../../../shared/ipc'
import type { AuthId, AuthSnapshot } from '../../contracts/auth'
import type { HarnessRuntimeConfigService } from './runtime-config'
import { availableModelsOf, normalizeAvailableModels } from './claude/available-models'
import { canonicalAgentKey, mergeAgentEnvironments, toAgentEnvironment } from './models'

export interface RuntimeModelContribution {
  authId: AuthId
  key: string
  harnessId: string
  modelProviderId: string
}

export interface RuntimeModelCatalog {
  list(): AgentEnvironment[]
  isReadOnly(key: string): boolean
  // settings 행 위에 런타임 행을 얹는다 — 선언된 contribution 이 cache 가 빌 때도 자기
  // canonical 행을 소유한다(D-008 fail-closed). 규칙이 소비처마다 재조립되면 새 소비처가
  // 조용히 빠뜨린다. `adapter` 를 주면 그 harness 행만 남긴다.
  merge(settings: AgentEnvironment[], adapter?: string): AgentEnvironment[]
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

  const ownsKey =
    (key: string) =>
    (contribution: RuntimeModelContribution): boolean =>
      canonicalAgentKey(contribution.key) === canonicalAgentKey(key)

  // 세대 증가는 **진행 중 fetch 를 무효로 만드는** 행위다 — 소멸 경로(무효 snapshot·명시
  // invalidate)만 부르고, 실패 정리(catch)는 부르지 않는다.
  const bumpGenerations = (authIds: Iterable<AuthId>): void => {
    for (const authId of new Set(authIds)) {
      authGeneration.set(authId, (authGeneration.get(authId) ?? 0) + 1)
    }
  }

  // 제거의 유일한 경로 — `resolvedRevision` 정리와 `onChange` 발화를 한 몸으로 묶는다.
  const drop = (targets: readonly RuntimeModelContribution[]): void => {
    let changed = false
    for (const target of targets) {
      resolvedRevision.delete(target.key)
      if (entries.delete(canonicalAgentKey(target.key))) changed = true
    }
    if (changed) input.onChange?.()
  }

  const reconcile = async (authId: AuthId, snapshot: AuthSnapshot): Promise<void> => {
    const contributions = input.contributions.filter((item) => item.authId === authId)
    if (contributions.length === 0) return
    if (!snapshot.verified || snapshot.status !== 'valid') {
      bumpGenerations([authId])
      drop(contributions)
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
            const models = normalizeAvailableModels(availableModelsOf(config) ?? [])
            const next =
              models.length === 0
                ? undefined
                : toAgentEnvironment(
                    { ...contribution, models },
                    { supported: true, source: 'runtime', readOnly: true }
                  )
            const key = canonicalAgentKey(contribution.key)
            const previous = entries.get(key)
            if (next) entries.set(key, next)
            else entries.delete(key)
            resolvedRevision.set(contribution.key, snapshot.credentialRevision)
            if (previous !== next) input.onChange?.()
          } catch {
            if ((authGeneration.get(authId) ?? 0) !== generation) return
            drop([contribution])
          } finally {
            inFlight.delete(contribution.key)
          }
        })()
        inFlight.set(contribution.key, work)
        return work
      })
    )
  }

  const list = (): AgentEnvironment[] =>
    [...entries.values()].sort((a, b) => a.key.localeCompare(b.key))
  const isReadOnly = (key: string): boolean => input.contributions.some(ownsKey(key))

  return {
    list,
    isReadOnly,
    merge: (settings, adapter) =>
      mergeAgentEnvironments(
        adapter === undefined ? settings : settings.filter((entry) => entry.adapter === adapter),
        adapter === undefined ? list() : list().filter((entry) => entry.adapter === adapter),
        isReadOnly
      ),
    invalidate(key) {
      const targets = key ? input.contributions.filter(ownsKey(key)) : input.contributions
      bumpGenerations(targets.map((contribution) => contribution.authId))
      drop(targets)
    },
    reconcile
  }
}
