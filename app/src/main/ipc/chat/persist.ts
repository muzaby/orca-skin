// 턴 persist — 어댑터가 yield 한 NormalizedEvent 를 DB 에 순서 보존 parts 로 기록
// (provider-runtime.md §7). 한 턴의 모든 assistant 파트는 같은 메시지에 누적되고
// telemetry(턴 종료)에서 reset 한다. AskUserQuestion tool_result 합성(flushAskAnswers)도
// 영속 책임이라 여기 둔다.

import type { WebContents } from 'electron'
import type { AttachmentView, NormalizedEvent } from '../../../shared/ipc'
import type { DbQueries } from '../../db'
import type { CostTracker } from '../../cost/tracker'
import { hasContextTokens } from '../../usage/usageMap'
import { materializeContinuityArrival } from '../../orchestration/fork'
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
  // 첨부가 있으면 text 파트 뒤에 attachment 파트(트랜스크립트 썸네일 영속분)를 덧붙인다.
  persistUserMessage(
    sessionId: string,
    text: string,
    createdAt: number,
    attachmentViews?: AttachmentView[]
  ): number {
    const id = this.db.appendMessage({ sessionId, role: 'user', content: text, createdAt })
    this.db.appendPart({
      messageId: id,
      type: 'text',
      toolRunId: null,
      payloadJson: JSON.stringify({ text })
    })
    if (attachmentViews && attachmentViews.length > 0) {
      this.db.appendPart({
        messageId: id,
        type: 'attachment',
        toolRunId: null,
        payloadJson: JSON.stringify({ attachments: attachmentViews })
      })
    }
    return id
  }

  persistSteerUserMessage(turn: InflightTurn, text: string, createdAt: number): number | null {
    const sessionId = turn.dbSessionId
    if (!sessionId) return null
    // 소비 확정 = 응답 경계. 진행 중 어시스턴트 메시지(소비 전 응답)를 먼저 마감·리셋해 steer
    // user row 가 그 뒤 idx 로 정렬되고, 이후 어시스턴트 파트는 ensureAssistantMessage 가 새
    // 메시지(steer 뒤)로 만든다 → 재로드 정렬 [응답-전][steer user][응답-후] = 라이브와 동일.
    // 마감을 안 하면 A 가 incomplete 로 남아 재로드 시 settleOrphanToolParts 를 타는 문제도 방지.
    if (turn.currentAssistantMessageId != null) {
      this.db.markMessageComplete(turn.currentAssistantMessageId)
      turn.currentAssistantMessageId = null
      turn.assistantText = ''
    }
    const id = this.persistUserMessage(sessionId, text, createdAt)
    this.db.updateSessionPreview(sessionId, previewOf(text), createdAt)
    return id
  }

  // 현재 assistant 메시지를 보장(없으면 빈 메시지 생성 + text 캐시 리셋)하고 id 를 반환한다.
  // 한 턴의 reasoning/text/tool_*/error 파트를 같은 메시지에 순서대로 묶기 위한 진입점.
  private ensureAssistantMessage(turn: InflightTurn, sessionId: string): number {
    if (turn.currentAssistantMessageId == null) {
      turn.currentAssistantMessageId = this.db.appendMessage({
        sessionId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        complete: 0
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
      // 답변이 채워진 Ask 는 더 이상 "열린 실행"이 아니다 — 중단 시 settleOpenToolRuns 가 abort
      // 결과로 답변을 덮어쓰지 않도록 추적에서 제거한다(실제 tool_result 는 늦게 올 수도 있음).
      turn.openToolRuns.delete(toolUseId)
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
          // backend 출처는 이 턴이 잠긴 어댑터(0010 세션-어댑터 바인딩) — 리터럴 금지(0016).
          backend: turn.titleAdapter.id,
          title,
          projectId: turn.pendingProjectId,
          createdAt: now,
          providerKey: turn.providerKey,
          cwd: turn.cwd
        })
        // 0062 continuity — fork/handoff 도착 물질화(lineage + fork 만 display 복사).
        // fork 복사가 원본 idx 를 보존하므로 아래 user 발화 영속(MAX(idx)+1)보다 먼저 실행해
        // 새 발화가 복사 이력 뒤로 정렬되게 한다.
        if (turn.lineage) {
          materializeContinuityArrival(this.db, {
            childSessionId: sessionId,
            parentSessionId: turn.lineage.parentSessionId,
            relation: turn.lineage.relation,
            createdAt: now
          })
        }
        if (turn.pendingUserText) {
          this.persistUserMessage(sessionId, turn.pendingUserText, now, turn.pendingAttachmentViews)
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
          payloadJson: JSON.stringify({
            toolName: ev.toolName,
            args: ev.args ?? null,
            ...(ev.parentToolRunId !== undefined ? { parentToolRunId: ev.parentToolRunId } : {})
          })
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
          payloadJson: JSON.stringify({
            text: ev.message.text,
            ...(ev.parentToolRunId !== undefined ? { parentToolRunId: ev.parentToolRunId } : {})
          })
        })
        // 서브에이전트(Task) child 텍스트는 메인 메시지 content/preview 를 오염시키지 않는다 —
        // 우측 패널 child 트랜스크립트 전용. assistantText 누적·세션 프리뷰 갱신은 최상위 텍스트만.
        if (ev.parentToolRunId === undefined) {
          turn.assistantText += ev.message.text
          this.db.updateMessageContent(id, turn.assistantText)
          this.db.updateSessionPreview(turn.dbSessionId, previewOf(ev.message.text), now)
        }
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
            ...(ev.durationMs !== undefined ? { durationMs: ev.durationMs } : {}),
            ...(ev.parentToolRunId !== undefined ? { parentToolRunId: ev.parentToolRunId } : {}),
            // 부모 Task 면 서브에이전트 메타(모델·시간·도구수) 영속 — 재로드 후 카드/행 복원.
            ...(ev.subagentMeta !== undefined ? { subagentMeta: ev.subagentMeta } : {})
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
      case 'session.compacted': {
        // SDK 네이티브 압축 완료 경계(0062) — 재로드 후에도 표시되도록 파트로 영속한다.
        if (!turn.dbSessionId) break
        const id = this.ensureAssistantMessage(turn, turn.dbSessionId)
        this.db.appendPart({
          messageId: id,
          type: 'compact_boundary',
          toolRunId: null,
          payloadJson: JSON.stringify({
            ...(ev.trigger !== undefined ? { trigger: ev.trigger } : {}),
            ...(ev.preTokens !== undefined ? { preTokens: ev.preTokens } : {})
          })
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
        if (turn.currentAssistantMessageId != null) {
          this.db.markMessageComplete(turn.currentAssistantMessageId)
        }
        this.onTurnEnd(turn)
        // 다음 assistant 파트는 새 메시지에 묶이도록 reset.
        turn.currentAssistantMessageId = null
        turn.assistantText = ''
        break
      }
      // message.delta/message.reasoning.delta/turn.retrying 은 transient(미저장).
      // permission.* 는 별도 row 없음. subagent.task 도 transient — 영속은 부모 Task
      // tool_result 의 subagentMeta(위 tool.call.completed)가 담당한다.
    }
  }
}
