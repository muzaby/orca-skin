export interface RespawnDecisionInput {
  channelAlive: boolean
  providerBoundaryChanged: boolean
  modelChanged: boolean
  providerSettingsChanged: boolean
  spawnedRuntimeToolsRevision: number | undefined
  runtimeToolsRevision: number | undefined
}

export function decideRespawn(input: RespawnDecisionInput): boolean {
  if (!input.channelAlive) return false

  return (
    input.providerBoundaryChanged ||
    input.modelChanged ||
    input.providerSettingsChanged ||
    input.spawnedRuntimeToolsRevision !== input.runtimeToolsRevision
  )
}
