import { describe, expect, it, vi } from 'vitest'
import type { TurnExtensions } from '../adapters/turn'
import {
  prepareAutomaticContinuation,
  type AutomaticContinuationRuntime
} from './chat-turn-continuation'

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
    spawnedModel: model,
    spawnedRuntimeToolsRevision: revision
  }
}

describe('chat turn automatic continuation (0158)', () => {
  it('uses one fresh listen snapshot for both stale detection and the request', async () => {
    const fresh = extensions(2)
    const buildExtensions = vi.fn(() => fresh)
    const resolveProvider = vi.fn(async () => ({ providerKey: 'team-a', model: 'opus' }))

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
        return { providerKey: 'team-a', model: 'opus' }
      },
      buildExtensions: () => extensions(2)
    })

    expect(prepared.model).toBe('opus')
    expect(prepared.shouldRespawn).toBe(false)
  })
})
