interface RespawnDecisionInput {
  channelAlive: boolean
  providerBoundaryChanged: boolean
  modelChanged: boolean
  providerSettingsChanged: boolean
  // 0188 — spawn 당시 adapter 입력(native settings + 최종 env)과 이번 값이 다른가.
  //
  // **기존 4개 판정을 대체하지 않는다.** `providerSettingsChanged` 는 settings blob 만 보고
  // (0125), 이 값은 **`options.env` 까지** 본다 — 같은 ModelProvider·같은 settings 인데 토큰·
  // URL·모델 환경변수만 바뀐 경우가 폐쇄망의 정상 흐름이고, 그때 stale subprocess 를 재사용하면
  // 죽은 토큰으로 계속 돈다. 반대로 정상 steady state 에서는 값이 같아 재사용이 유지된다.
  runtimeConfigChanged: boolean
  spawnedRuntimeToolsRevision: number | undefined
  runtimeToolsRevision: number | undefined
}

export function decideRespawn(input: RespawnDecisionInput): boolean {
  if (!input.channelAlive) return false

  return (
    input.providerBoundaryChanged ||
    input.modelChanged ||
    input.providerSettingsChanged ||
    input.runtimeConfigChanged ||
    input.spawnedRuntimeToolsRevision !== input.runtimeToolsRevision
  )
}
