import { describe, expect, it, vi } from 'vitest'
import type { TurnExtensions } from '../adapters/turn'
import type { PreparedHarnessConfig } from '../adapters/harness-config'
import {
  prepareAutomaticContinuation,
  type AutomaticContinuationRuntime
} from './chat-turn-continuation'

// continuation 마다 새로 조립되는 spawn 입력 한 벌. fingerprint 가 spawn 기록과 같으면
// respawn 판정에 영향을 주지 않는다.
function preparedConfig(fingerprint = 'fp-1'): PreparedHarnessConfig {
  return { runtimeEnvFingerprint: fingerprint, envFingerprint: fingerprint }
}

function extensions(revision: number): TurnExtensions {
  return {
    mcp: {},
    skills: [],
    hooks: { normalized: {} },
    runtimeTools: { revision, servers: new Map() }
  }
}

function runtime(revision: number, model: string): AutomaticContinuationRuntime {
  return {
    channelAlive: true,
    spawnedProviderSettings: undefined,
    spawnedRuntimeEnvFingerprint: undefined,
    spawnedModel: model,
    spawnedRuntimeToolsRevision: revision
  }
}

describe('chat turn automatic continuation (0158)', () => {
  it('uses one fresh listen snapshot for both stale detection and the request', async () => {
    const fresh = extensions(2)
    const buildExtensions = vi.fn(() => fresh)
    const resolveProvider = vi.fn(async () => ({
      providerKey: 'team-a',
      model: 'opus',
      prepared: preparedConfig()
    }))

    const prepared = await prepareAutomaticContinuation({
      runtime: runtime(1, 'opus'),
      providerKey: 'team-a',
      modelFamily: 'high',
      fallbackModel: 'opus',
      resolveProvider,
      buildExtensions
    })

    expect(resolveProvider).toHaveBeenCalledWith({ providerKey: 'team-a', modelFamily: 'high' })
    expect(buildExtensions).toHaveBeenCalledTimes(1)
    expect(prepared.extensions).toBe(fresh)
    expect(prepared.shouldRespawn).toBe(true)
  })

  it('preserves the selected model family for flush continuation without a false mismatch', async () => {
    const prepared = await prepareAutomaticContinuation({
      runtime: runtime(2, 'opus'),
      providerKey: 'team-a',
      modelFamily: 'high',
      fallbackModel: 'opus',
      resolveProvider: async ({ modelFamily }) => {
        expect(modelFamily).toBe('high')
        return { providerKey: 'team-a', model: 'opus', prepared: preparedConfig() }
      },
      buildExtensions: () => extensions(2)
    })

    expect(prepared.model).toBe('opus')
    expect(prepared.shouldRespawn).toBe(false)
  })
})

// 0188 — settings 는 그대로인데 **동적 env(토큰·URL·모델 변수)만** 바뀐 continuation.
// 구 구현은 settings blob 만 비교해 이 경우를 놓쳤고, listen/flush 가 옛 env 로 respawn 했다.
describe('chat turn automatic continuation — runtime config fingerprint (0188)', () => {
  it('fingerprint 가 spawn 값과 다르면 respawn 한다', async () => {
    const result = await prepareAutomaticContinuation({
      runtime: {
        channelAlive: true,
        spawnedProviderSettings: undefined,
        spawnedRuntimeEnvFingerprint: 'fp-old',
        spawnedModel: 'opus',
        spawnedRuntimeToolsRevision: 2
      },
      providerKey: 'team-a',
      modelFamily: 'high',
      fallbackModel: 'opus',
      resolveProvider: async () => ({
        providerKey: 'team-a',
        model: 'opus',
        prepared: preparedConfig('fp-new')
      }),
      buildExtensions: () => extensions(2)
    })

    expect(result.shouldRespawn).toBe(true)
  })

  it('fingerprint 가 같으면 persistent runtime 을 재사용한다', async () => {
    const result = await prepareAutomaticContinuation({
      runtime: {
        channelAlive: true,
        spawnedProviderSettings: undefined,
        spawnedRuntimeEnvFingerprint: 'fp-same',
        spawnedModel: 'opus',
        spawnedRuntimeToolsRevision: 2
      },
      providerKey: 'team-a',
      modelFamily: 'high',
      fallbackModel: 'opus',
      resolveProvider: async () => ({
        providerKey: 'team-a',
        model: 'opus',
        prepared: preparedConfig('fp-same')
      }),
      buildExtensions: () => extensions(2)
    })

    expect(result.shouldRespawn).toBe(false)
  })

  it('spawn 기록이 없으면(콜드 스타트) 판정하지 않는다 — 보수적 no-op', async () => {
    const result = await prepareAutomaticContinuation({
      runtime: {
        channelAlive: true,
        spawnedProviderSettings: undefined,
        spawnedRuntimeEnvFingerprint: undefined,
        spawnedModel: 'opus',
        spawnedRuntimeToolsRevision: 2
      },
      providerKey: 'team-a',
      modelFamily: 'high',
      fallbackModel: 'opus',
      resolveProvider: async () => ({
        providerKey: 'team-a',
        model: 'opus',
        prepared: preparedConfig('fp-new')
      }),
      buildExtensions: () => extensions(2)
    })

    expect(result.shouldRespawn).toBe(false)
  })
})
