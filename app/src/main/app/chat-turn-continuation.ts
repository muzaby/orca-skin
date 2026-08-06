import type { TurnExtensions } from '../adapters/turn'
import type { ResolvedProviderSettings } from '../features/providers/provider-settings'
import {
  crossesProviderBoundary,
  providerSettingsChangedSinceSpawn
} from '../features/providers/provider-settings'
import { decideRespawn } from '../features/sessions/respawn-policy'

export interface AutomaticContinuationRuntime {
  readonly channelAlive: boolean
  readonly spawnedProviderSettings: ResolvedProviderSettings | undefined
  readonly spawnedModel: string | undefined
  readonly spawnedRuntimeToolsRevision: number | undefined
}

interface AutomaticContinuationResolution {
  providerKey: string | null
  providerSettings?: ResolvedProviderSettings
  model?: string
}

interface PreparedAutomaticContinuation {
  extensions: TurnExtensions
  providerSettings?: ResolvedProviderSettings
  model?: string
  shouldRespawn: boolean
}

// Listen and flush must compare and send the exact same fresh extension snapshot.
export async function prepareAutomaticContinuation(input: {
  runtime: AutomaticContinuationRuntime
  providerKey: string | null
  modelFamily: string | null
  fallbackModel: string | undefined
  resolveProvider: (request: {
    providerKey: string | null
    modelFamily: string | null
  }) => Promise<AutomaticContinuationResolution>
  buildExtensions: () => TurnExtensions
}): Promise<PreparedAutomaticContinuation> {
  const resolved = await input.resolveProvider({
    providerKey: input.providerKey,
    modelFamily: input.modelFamily
  })
  const extensions = input.buildExtensions()
  const model = resolved.model ?? input.fallbackModel

  return {
    extensions,
    ...(resolved.providerSettings ? { providerSettings: resolved.providerSettings } : {}),
    ...(model !== undefined ? { model } : {}),
    shouldRespawn: decideRespawn({
      channelAlive: input.runtime.channelAlive,
      providerBoundaryChanged: crossesProviderBoundary(input.providerKey, resolved.providerKey),
      modelChanged: model !== input.runtime.spawnedModel,
      providerSettingsChanged: providerSettingsChangedSinceSpawn(
        input.runtime.spawnedProviderSettings,
        resolved.providerSettings
      ),
      spawnedRuntimeToolsRevision: input.runtime.spawnedRuntimeToolsRevision,
      runtimeToolsRevision: extensions.runtimeTools?.revision
    })
  }
}
