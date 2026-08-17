export interface RespawnDecisionInput {
  channelAlive: boolean
  providerBoundaryChanged: boolean
  modelChanged: boolean
  providerSettingsChanged: boolean
  // 0188 — spawn 당시 **최종 env** 와 이번 값이 다른가.
  //
  // 위 `providerSettingsChanged` 와 **겹치지 않는 축**이다. 그쪽은 settings blob 만 보고(0125),
  // 이쪽은 `options.env` 만 본다 — 같은 ModelProvider·같은 settings 인데 토큰·URL·모델
  // 환경변수만 바뀐 경우가 폐쇄망의 정상 흐름이고, 그때 stale subprocess 를 재사용하면 죽은
  // 토큰으로 계속 돈다. 정상 steady state 에서는 값이 같아 재사용이 유지된다.
  //
  // ⚠️ 두 축을 하나의 fingerprint 로 합치지 마라(r1 이 그렇게 했다가 되돌렸다) — settings 변화가
  // 두 입력에 동시에 나타나고, 0125 의 "해석 실패는 경계가 아니다" 가 조용히 뒤집힌다.
  runtimeEnvChanged: boolean
  spawnedRuntimeToolsRevision: number | undefined
  runtimeToolsRevision: number | undefined
}

export function decideRespawn(input: RespawnDecisionInput): boolean {
  if (!input.channelAlive) return false

  return (
    input.providerBoundaryChanged ||
    input.modelChanged ||
    input.providerSettingsChanged ||
    input.runtimeEnvChanged ||
    input.spawnedRuntimeToolsRevision !== input.runtimeToolsRevision
  )
}
