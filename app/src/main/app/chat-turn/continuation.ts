// 자동 연속 턴의 TurnRequest 조립 — **순수 함수만** 산다 (0179).
//
// listen 과 flush 는 같은 루프에서 갈리지만 조립 규칙이 정반대다. 그 차이가 리터럴로 흩어져
// 있어 회귀가 두 번 났다(0149 첨부 누수 · 0166 D7 위임 절반). 여기 두 함수로 고정한다.

import type { ResolvedProviderSettings } from '../../adapters/provider-config'
import type { SteerFlushBatch, TurnRequest } from '../../adapters/turn'
import { pickFrameDelegates } from '../../features/sessions/session-runtime'

// `prepareAutomaticContinuation` 결과 중 요청 조립이 쓰는 부분만. 구조적으로 받아 모듈 간
// 타입 결합을 만들지 않는다.
export interface ContinuationSettings {
  extensions: TurnRequest['extensions']
  providerSettings?: ResolvedProviderSettings | undefined
  model?: string | undefined
}

// listen 턴 — 입력 push 없이 프레임만 소비해 CLI 자동 턴(진행·task_notification·완료 알림)을
// 라이브 배달한다.
//
// **원 request 를 spread 하지 않는다 (0149)**: 그 턴의 base64 첨부(수 MB)가 listen phase(분 단위)
// 내내 살아남는다. 대신 **프레임 위임은 전부 넘긴다 (0166 D7)** — `adoptDelegate` 가 delegate 를
// 통째로 교체하므로 절반만 실으면 listen 프레임 동안 commit/rollback 이 사라져 게이트 훅이
// 배치를 `submitting` 에 가둔다. 목록을 손으로 나열하지 않고 `pickFrameDelegates` 로 받는다.
export function buildListenRequest(input: {
  base: TurnRequest
  sessionId: string
  signal: AbortSignal
  continuation: ContinuationSettings
}): TurnRequest {
  const { continuation } = input
  return {
    sessionId: input.sessionId,
    text: '',
    cwd: input.base.cwd,
    extensions: continuation.extensions,
    signal: input.signal,
    ...(continuation.model !== undefined ? { model: continuation.model } : {}),
    ...(continuation.providerSettings ? { providerSettings: continuation.providerSettings } : {}),
    ...pickFrameDelegates(input.base)
  }
}

// flush 턴 — 이전 턴이 남긴 held 예약을 다음 턴 프롬프트로 잇는다.
//
// 원 request 를 승계하되 **continuity 표식은 떨어뜨린다**: `forkFrom` 을 이으면 재분기하고,
// `handoff` 를 이으면 매퍼가 후속 연속 턴의 실측 telemetry 까지 무효화한다(0127).
export function buildFlushRequest(input: {
  base: TurnRequest
  sessionId: string
  signal: AbortSignal
  batch: SteerFlushBatch
  preludes: SteerFlushBatch[]
  continuation: ContinuationSettings
}): TurnRequest {
  const { batch, preludes, continuation } = input
  const request: TurnRequest = {
    ...input.base,
    sessionId: input.sessionId,
    text: batch.text,
    promptUuid: batch.uuid,
    signal: input.signal,
    attachmentTexts: batch.attachmentTexts ?? [],
    attachmentImages: batch.attachmentImages ?? [],
    extensions: continuation.extensions,
    // 0126: respawn 대비 신선한 settings 로 교체 — 해석 실패(undefined)면 원본 유지(보수적).
    ...(continuation.providerSettings ? { providerSettings: continuation.providerSettings } : {}),
    ...(continuation.model !== undefined ? { model: continuation.model } : {})
  }
  delete request.forkFrom
  delete request.handoff
  if (preludes.length > 0) request.preludes = preludes
  else delete request.preludes
  return request
}
