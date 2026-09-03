import type { AgentEnvironment } from '../../../shared/ipc'
import type { AuthId, AuthSnapshot } from '../../contracts/auth'
import type { HarnessRuntimeConfigService } from './runtime-config'
import {
  availableModelsOf,
  explicitModelOf,
  markDefaultModel,
  normalizeAvailableModels,
  withExplicitModel
} from './claude/available-models'
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
  invalidate(key?: string): Promise<void>
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
  snapshotOf: (authId: AuthId) => AuthSnapshot
  onChange?: () => void
}): RuntimeModelCatalog {
  const entries = new Map<string, AgentEnvironment>()
  const authGeneration = new Map<AuthId, number>()
  const resolvedRevision = new Map<string, number>()
  const inFlight = new Map<string, { generation: number; promise: Promise<void> }>()

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
        if (pending?.generation === generation) return pending.promise
        // An invalidation can advance the generation while an older fetch is still pending.
        // Waiting for that stale work would leave the dropped entry empty, so let the latest
        // generation start its own resolve. The generation fence below prevents the old result
        // from publishing, and the identity guard in `finally` preserves the newer slot.
        const slot: { generation: number; promise: Promise<void> } = {
          generation,
          promise: Promise.resolve()
        }
        const work = (async (): Promise<void> => {
          try {
            const config = await input.runtime.resolve(contribution)
            if ((authGeneration.get(authId) ?? 0) !== generation) return
            // `ANTHROPIC_MODEL` 은 settings 경로와 **같은 규칙**으로 목록에 더한다(0215 D-006).
            // runtime 기여는 `availableModels` 만 실을 수도 있어, 배포가 지정한 실행 모델이
            // 선택지에 없던 자리다. 중복이면 추가하지 않는다.
            const explicit = explicitModelOf(config.runtimeEnv?.ANTHROPIC_MODEL)
            const models = withExplicitModel(
              normalizeAvailableModels(availableModelsOf(config) ?? []),
              explicit
            )
            // 편입 후 default 를 **다시** 매긴다 — settings 경로와 같은 순서다. 목록만 늘리고
            // 이 줄을 빼면 배포가 지정한 실행 모델이 목록에는 있는데 기본 선택은 다른 것이 된다.
            markDefaultModel(models, explicit)
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
            if (inFlight.get(contribution.key) === slot) {
              inFlight.delete(contribution.key)
            }
          }
        })()
        slot.promise = work
        inFlight.set(contribution.key, slot)
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
    async invalidate(key) {
      const targets = key ? input.contributions.filter(ownsKey(key)) : input.contributions
      bumpGenerations(targets.map((contribution) => contribution.authId))
      drop(targets)
      const authIds = new Set(targets.map((contribution) => contribution.authId))
      await Promise.all([...authIds].map((authId) => reconcile(authId, input.snapshotOf(authId))))
    },
    reconcile
  }
}
