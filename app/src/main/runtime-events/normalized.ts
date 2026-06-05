// NormalizedEvent 매퍼 — provider 중립 이벤트(provider-runtime.md §2)의 claude 변환기.
// 타입(NormalizedEvent·ProviderId)은 와이어 타입이라 shared/ipc.ts 가 정본. 본 파일은 매퍼만.
//
// 스테이지 B1': 어댑터가 SDK 메시지를 normalize()(ChatEvent 중간표현)한 뒤 chatEventToNormalized 로
// 변환해 NormalizedEvent 를 yield 한다. B2 에서 permission.requested(origin:'agent') 1급 이벤트를 추가.

import type { ChatEvent, NormalizedEvent, ProviderId } from '../../shared/ipc'

export type { NormalizedEvent, ProviderId }

// 매퍼 컨텍스트 — provider 고정, sessionId 는 턴 동안 init(=session.updated)에서 갱신된다.
// 한 provider 원본 1개가 N개 NormalizedEvent 로 분해될 수 있다(예: assistant = message + tool).
export interface MapContext {
  provider: ProviderId
  sessionId: string
  cwd: string
}

// 현행 ChatEvent → NormalizedEvent 전수 매핑(provider-runtime.md §2 매핑표 그대로).
// init→session.updated 는 ctx.sessionId 를 갱신(부수효과) — 이후 같은 턴의 delta/tool 이벤트가
// 올바른 sessionId 를 갖도록. ask_question/plan_review 는 B2 가 permission.requested 로 흡수하므로
// 여기선 비운다([] — 와이어 전환 전이라 소실 영향 없음).
export function chatEventToNormalized(ev: ChatEvent, ctx: MapContext): NormalizedEvent[] {
  const { provider } = ctx
  switch (ev.type) {
    case 'init':
      ctx.sessionId = ev.data.sessionId
      return [
        {
          type: 'session.updated',
          sessionId: ev.data.sessionId,
          provider,
          patch: {
            ...(ev.data.model !== undefined ? { model: ev.data.model } : {}),
            cwd: ev.data.cwd
          }
        }
      ]
    case 'assistant_delta':
      return [
        { type: 'message.delta', sessionId: ctx.sessionId, provider, delta: { text: ev.data.text } }
      ]
    case 'assistant_message':
      return [
        {
          type: 'message.completed',
          sessionId: ctx.sessionId,
          provider,
          message: { text: ev.data.text }
        }
      ]
    case 'tool_use':
      return [
        {
          type: 'tool.call.started',
          sessionId: ctx.sessionId,
          provider,
          toolRunId: ev.data.toolUseId,
          toolName: ev.data.name,
          args: ev.data.input
        }
      ]
    case 'tool_result':
      return [
        {
          type: 'tool.call.completed',
          sessionId: ctx.sessionId,
          provider,
          toolRunId: ev.data.toolUseId,
          result: ev.data.output,
          isError: ev.data.isError,
          ...(ev.data.durationMs !== undefined ? { durationMs: ev.data.durationMs } : {})
        }
      ]
    case 'result':
      return [
        {
          type: 'telemetry',
          sessionId: ctx.sessionId,
          provider,
          ...(ev.data.usage !== undefined ? { usage: ev.data.usage } : {})
        }
      ]
    case 'error':
      return [
        {
          type: 'error',
          ...(ctx.sessionId !== '' ? { sessionId: ctx.sessionId } : {}),
          provider,
          error: ev.data
        }
      ]
    case 'ask_question':
    case 'plan_review':
      // B2 에서 permission.requested(origin:'agent')로 흡수.
      return []
  }
}
