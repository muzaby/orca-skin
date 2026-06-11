// 턴 persist — 어댑터가 yield 한 NormalizedEvent 를 DB 에 순서 보존 parts 로 기록
// (provider-runtime.md §7). 한 턴의 모든 assistant 파트는 같은 메시지에 누적되고
// telemetry(턴 종료)에서 reset 한다. AskUserQuestion tool_result 합성(flushAskAnswers)도
// 영속 책임이라 여기 둔다.

import type { WebContents } from 'electron'
import type { NormalizedEvent } from '../../../shared/ipc'
import type { DbQueries } from '../../db'
import type { CostTracker } from '../../cost/tracker'
import { hasContextTokens } from '../../usage/usageMap'
import { previewOf } from '../dto'
import { sendChatEvent } from '../context'
import type { InflightTurn } from './turn-registry'

export class TurnPersistence {
  constructor(
    private readonly db: DbQueries,
    private readonly cost: CostTracker,
    // telemetry(턴 종료) 시점 후처리 — 제목 자동 생성 트리거(TitleGenerator.maybeStart).
    private readonly onTurnEnd: (turn: InflightTurn) => void
  ) {}

  // user 메시지 1건을 messages row + text 파트로 영속한다(content 는 FTS5 캐시).
  persistUserMessage(sessionId: string, text: string, createdAt: number): void {
    const id = this.db.appendMessage({ sessionId, role: 'user', content: text, createdAt })
    this.db.appendPart({
      messageId: id,
      type: 'text',
      toolRunId: null,
      payloadJson: JSON.stringify({ text })
    })
  }

  // 현재 assistant 메시지를 보장(없으면 빈 메시지 생성 + text 캐시 리셋)하고 id 를 반환한다.
  // 한 턴의 reasoning/text/tool_*/error 파트를 같은 메시지에 순서대로 묶기 위한 진입점.
  private ensureAssistantMessage(turn: InflightTurn, sessionId: string): number {
    if (turn.currentAssistantMessageId == null) {
      turn.currentAssistantMessageId = this.db.appendMessage({
        sessionId,
        role: 'assistant',
        content: '',
        createdAt: Date.now()
      })
      turn.assistantText = ''
    }
    return turn.currentAssistantMessageId
  }

  // AskUserQuestion 답변과 tool_use id 를 페어링해 tool_result 를 합성한다(SDK 가 answers 를
  // 안 돌려주므로). 페어가 생길 때마다 DB 저장 + renderer 로 tool_result ChatEvent 전송 →
  // 카드가 결과를 받아 '질문 중'→'요청됨' 으로 전이하고 AskExchange 가 답변 버블을 렌더한다.
  flushAskAnswers(turn: InflightTurn, wc: WebContents): void {
    while (turn.pendingAskAnswers.length > 0 && turn.askPendingIds.length > 0) {
      const toolUseId = turn.askPendingIds.shift()!
      const a = turn.pendingAskAnswers.shift()!
      const output = {
        answers: a.answers,
        ...(a.response !== undefined ? { response: a.response } : {})
      }
      turn.askResolved.set(toolUseId, a)
      // AskUserQuestion 은 SDK tool_result 가 안 오므로 합성 — 현재 assistant 메시지에
      // tool_result 파트를 upsert(실제 tool_result 가 늦게 와도 같은 toolRunId 로 덮어쓴다).
      if (turn.currentAssistantMessageId != null) {
        this.db.upsertToolResultPart(
          turn.currentAssistantMessageId,
          toolUseId,
          JSON.stringify({ result: output, isError: false })
        )
      }
      sendChatEvent(wc, {
        type: 'tool.call.completed',
        sessionId: turn.dbSessionId ?? '',
        provider: 'claude-code',
        toolRunId: toolUseId,
        result: output,
        isError: false
      })
    }
  }

  persist(turn: InflightTurn, ev: NormalizedEvent): void {
    const now = Date.now()
    switch (ev.type) {
      case 'session.updated': {
        // claude 의 system/init — sessionId 발급 시점. sessions row 생성 + 대기 user 메시지 기록.
        const sessionId = ev.sessionId
        turn.dbSessionId = sessionId
        const title = turn.pendingUserText ? previewOf(turn.pendingUserText, 60) : null
        this.db.insertSession({
          id: sessionId,
          backend: 'claude-code',
          title,
          projectId: turn.pendingProjectId,
          createdAt: now,
          providerKey: turn.providerKey
        })
        if (turn.pendingUserText) {
          this.persistUserMessage(sessionId, turn.pendingUserText, now)
          this.db.updateSessionPreview(sessionId, previewOf(turn.pendingUserText), now)
          this.db.updateSessionProviderKey(sessionId, turn.providerKey, now)
          if (title) this.db.updateSessionTitle(sessionId, title)
          turn.pendingUserText = null
        }
        break
      }
      case 'message.reasoning': {
        if (!turn.dbSessionId) break
        const id = this.ensureAssistantMessage(turn, turn.dbSessionId)
        this.db.appendPart({
          messageId: id,
          type: 'reasoning',
          toolRunId: null,
          payloadJson: JSON.stringify({
            text: ev.text,
            ...(ev.signature !== undefined ? { signature: ev.signature } : {})
          })
        })
        break
      }
      case 'tool.call.started': {
        if (!turn.dbSessionId) break
        const id = this.ensureAssistantMessage(turn, turn.dbSessionId)
        this.db.appendPart({
          messageId: id,
          type: 'tool_call',
          toolRunId: ev.toolRunId,
          payloadJson: JSON.stringify({ toolName: ev.toolName, args: ev.args ?? null })
        })
        break
      }
      case 'message.completed': {
        if (!turn.dbSessionId) break
        const id = this.ensureAssistantMessage(turn, turn.dbSessionId)
        this.db.appendPart({
          messageId: id,
          type: 'text',
          toolRunId: null,
          payloadJson: JSON.stringify({ text: ev.message.text })
        })
        turn.assistantText += ev.message.text
        this.db.updateMessageContent(id, turn.assistantText)
        this.db.updateSessionPreview(turn.dbSessionId, previewOf(ev.message.text), now)
        break
      }
      case 'tool.call.completed': {
        if (!turn.dbSessionId) break
        // 합성으로 이미 답변을 채운 AskUserQuestion id 에 실제 tool_result 가 뒤늦게 오면
        // 저장된 answers 로 재주입해 빈 output 으로 덮어쓰지 않게 한다.
        const resolved = turn.askResolved.get(ev.toolRunId)
        if (resolved) {
          ev.result = {
            answers: resolved.answers,
            ...(resolved.response !== undefined ? { response: resolved.response } : {})
          }
        }
        const id = this.ensureAssistantMessage(turn, turn.dbSessionId)
        this.db.upsertToolResultPart(
          id,
          ev.toolRunId,
          JSON.stringify({
            result: ev.result ?? null,
            isError: ev.isError,
            ...(ev.durationMs !== undefined ? { durationMs: ev.durationMs } : {})
          })
        )
        break
      }
      case 'error': {
        if (!turn.dbSessionId) break
        const id = this.ensureAssistantMessage(turn, turn.dbSessionId)
        this.db.appendPart({
          messageId: id,
          type: 'error',
          toolRunId: null,
          payloadJson: JSON.stringify({ error: ev.error })
        })
        break
      }
      case 'telemetry': {
        // 턴 종료 — 사용량 부모/자식 행을 turn_usage 원장에 적재. 시간 집계 + 세션 최신 행에서
        // 컨텍스트 도넛/패널 복원의 원천. usage 없거나 컨텍스트 0(/context 등 로컬 슬래시
        // 명령 — 모델 미호출)이면 스킵 — 빈 행이 최신 행으로 도넛을 0으로 덮지 않게.
        const u = ev.usage
        if (turn.dbSessionId && u && hasContextTokens(u)) {
          const turnUsageId = this.db.insertTurnUsage({
            sessionId: turn.dbSessionId,
            messageId: turn.currentAssistantMessageId,
            createdAt: now,
            inputTokens: u.inputTokens ?? null,
            outputTokens: u.outputTokens ?? null,
            cacheCreationInputTokens: u.cacheCreationTokens ?? null,
            cacheReadInputTokens: u.cacheReadTokens ?? null,
            totalCostUsd: u.costUsd ?? null
          })
          const modelEntries = Object.entries(u.modelUsage ?? {})
          if (modelEntries.length > 0) {
            for (const [model, mu] of modelEntries) {
              this.db.insertTurnModelUsage({
                turnUsageId,
                model,
                inputTokens: mu.inputTokens ?? null,
                outputTokens: mu.outputTokens ?? null,
                cacheCreationInputTokens: mu.cacheCreationTokens ?? null,
                cacheReadInputTokens: mu.cacheReadTokens ?? null,
                costUsd: mu.costUsd ?? null
              })
            }
          } else if (u.model) {
            this.db.insertTurnModelUsage({
              turnUsageId,
              model: u.model,
              inputTokens: u.inputTokens ?? null,
              outputTokens: u.outputTokens ?? null,
              cacheCreationInputTokens: u.cacheCreationTokens ?? null,
              cacheReadInputTokens: u.cacheReadTokens ?? null,
              costUsd: u.costUsd ?? null
            })
          }
          this.cost.recordAndBroadcast()
        }
        this.onTurnEnd(turn)
        // 다음 assistant 파트는 새 메시지에 묶이도록 reset.
        turn.currentAssistantMessageId = null
        turn.assistantText = ''
        break
      }
      // message.delta 는 transient(미저장). permission.* 는 별도 row 없음.
    }
  }
}
