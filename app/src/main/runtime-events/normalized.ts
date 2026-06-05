// NormalizedEvent — provider 중립 이벤트 union (provider-runtime.md §2 정본).
//
// 스테이지 B1: 타입 + 순수 매퍼를 main 내부에 확정한다(아직 IPC 와이어엔 올리지 않는다 — 위험 0).
// B1' 에서 와이어(orca:chat:event)·reducer·persist 를 이 타입으로 전환하고, B2 에서
// permission.requested/resolved 1급 이벤트(PermissionAction·ApprovalResolution)를 추가한다.
//
// 추상화 본체: 모든 이벤트가 sessionId(멀티세션 라우팅)·provider 를 갖고, tool 은 toolRunId 로
// start/complete 를 매칭한다. OpenCode 는 provider:'opencode' 매퍼가 같은 union 으로 정규화한다(seam).

import type { ChatEvent, ErrorCode } from '../../shared/ipc'

export type ProviderId = 'claude-code' | 'opencode'

// B1 스코프 union — claude 매퍼가 실제 생성하는 스트리밍 이벤트. permission.requested/resolved 는
// B2 에서 PermissionAction·ApprovalResolution 과 함께 추가된다(SSOT §2 의 완전 union 의 부분집합).
export type NormalizedEvent =
  | {
      type: 'session.updated'
      sessionId: string
      provider: ProviderId
      patch: { model?: string; cwd?: string }
    }
  | { type: 'message.delta'; sessionId: string; provider: ProviderId; delta: { text: string } }
  | {
      type: 'message.completed'
      sessionId: string
      provider: ProviderId
      message: { text: string }
    }
  | {
      type: 'tool.call.started'
      sessionId: string
      provider: ProviderId
      toolRunId: string
      toolName: string
      args: unknown
    }
  | {
      type: 'tool.call.completed'
      sessionId: string
      provider: ProviderId
      toolRunId: string
      result: unknown
      isError: boolean
      durationMs?: number
    }
  | {
      type: 'telemetry'
      sessionId: string
      provider: ProviderId
      usage?: { inputTokens: number; outputTokens: number }
    }
  | {
      type: 'error'
      sessionId?: string
      provider: ProviderId
      error: { code: ErrorCode; message: string; recoverable: boolean }
    }

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
