// 턴 persist — 어댑터가 yield 한 NormalizedEvent 를 DB 에 순서 보존 parts 로 기록
// (provider-runtime.md §7). 한 턴의 모든 assistant 파트는 같은 메시지에 누적되고
// telemetry(턴 종료)에서 reset 한다. AskUserQuestion tool_result 합성(flushAskAnswers)도
// 영속 책임이라 여기 둔다.

import type { WebContents } from 'electron'
import type { AttachmentView, NormalizedEvent } from '../../../shared/ipc'
import { subagentNoticePart } from '../../../shared/ipc'
import type { DbQueries } from '../../infra/db'
import type { LineageRelation } from '../../infra/db/types'
import { previewOf } from '../../infra/ipc/dto'
import { sendChatEvent } from '../../infra/ipc/send'
import { getLogger } from '../../infra/log/registry'
import type { TurnContext } from '../../contracts/turn'

// 0064 continuity — fork/handoff 도착 물질화 훅(구조적 포트). 구현은 features/orchestration
// 의 materializeContinuityArrival 이고 컴포지션 루트(app/bootstrap)가 주입한다 — feature
// 교차 import 금지 해소책 (b)/(c).
export type ContinuityArrivalHook = (arrival: {
  childSessionId: string
  parentSessionId: string
  relation: LineageRelation
  createdAt: number
}) => void

// 턴 영속(history) — 사용량 집계(usage/subscriber)·제목 생성(TitleGenerator)은 별개 버스 구독자로
// 분리됐다(0062). 여기 telemetry 처리는 assistant 메시지 마감 + 다음 턴 대비 reset 만 담당한다.
export class HistoryWriter {
  constructor(
    private readonly db: DbQueries,
    private readonly onContinuityArrival?: ContinuityArrivalHook
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

  // 사용자 메시지 커밋(0067 AC6) — **echo 관측 시점의 단일 영속 경로**. 턴 프롬프트·프렐류드
  // (이월)·steer 게이트 배치가 전부 여기로 커밋된다(구 persistSteerUserMessage 일반화).
  // 소비 확정 = 응답 경계. 진행 중 어시스턴트 메시지(소비 전 응답)를 먼저 마감·리셋해 user row
  // 가 그 뒤 idx 로 정렬되고, 이후 어시스턴트 파트는 ensureAssistantMessage 가 새 메시지로
  // 만든다 → 재로드 정렬 [응답-전][user][응답-후] = 라이브와 동일. preview/provider_key 갱신도
  // 커밋 시점 소유(0067 — send 시점 선영속 제거).
  commitUserMessage(
    turn: TurnContext,
    batch: { text: string; createdAt: number; attachmentViews?: AttachmentView[] }
  ): number | null {
    const sessionId = turn.dbSessionId
    if (!sessionId) return null
    this.finalizeTurn(turn)
    const id = this.persistUserMessage(
      sessionId,
      batch.text,
      batch.createdAt,
      batch.attachmentViews
    )
    this.db.updateSessionPreview(sessionId, previewOf(batch.text), batch.createdAt)
    this.db.updateSessionProviderKey(sessionId, turn.providerKey, batch.createdAt)
    return id
  }

  // assistant 메시지 마감 — content(FTS5 캐시)를 파트 누적분으로 이 시점 1회만 동기화한다.
  // 스트리밍 중 블록마다 전체 content 를 재기록하면 FTS 트리거(messages_au)가 매번 전체를
  // 재색인해 응답 길이에 초선형 비용이 든다(0107) — 기록은 메시지가 닫히는 경계로 미룬다.
  // finalize 이전 비정상 종료의 FTS 공백은 rebuildIncompleteMessageContent(부팅·세션 send)가 복구.
  private finalizeAssistantMessage(turn: TurnContext): void {
    if (turn.currentAssistantMessageId == null) return
    this.db.updateMessageContent(turn.currentAssistantMessageId, turn.assistantText)
    this.db.markMessageComplete(turn.currentAssistantMessageId)
  }

  // 진행 중 assistant 메시지를 마감하고 reset 한다 — 마감+리셋 쌍의 단일 경로.
  // 버스 밖 턴 종료 경계(chatCancel 등)와 내부 경계(user 커밋·telemetry)가 공유한다.
  finalizeTurn(turn: TurnContext): void {
    this.finalizeAssistantMessage(turn)
    turn.currentAssistantMessageId = null
    turn.assistantText = ''
  }

  // 현재 assistant 메시지를 보장(없으면 빈 메시지 생성 + text 캐시 리셋)하고 id 를 반환한다.
  // 한 턴의 reasoning/text/tool_*/error 파트를 같은 메시지에 순서대로 묶기 위한 진입점.
  private ensureAssistantMessage(turn: TurnContext, sessionId: string): number {
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
  flushAskAnswers(turn: TurnContext, wc: WebContents): void {
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

  persist(turn: TurnContext, ev: NormalizedEvent): void {
    const now = Date.now()
    switch (ev.type) {
      case 'session.updated': {
        // claude 의 system/init — sessionId 발급 시점. sessions row 생성 + 대기 user 메시지 기록.
        const sessionId = ev.sessionId
        turn.dbSessionId = sessionId
        // continuity 는 마커 제목([분기]/[핸드오프] <원본>) 오버라이드, 그 외엔 첫 발화 preview.
        const title =
          turn.initialTitle ?? (turn.pendingUserText ? previewOf(turn.pendingUserText, 60) : null)
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
        // 세션 생성 경계(0124 카탈로그) — sessionId 발급 시점(system/init)이 생성의 진실.
        if (turn.isNewSession) {
          getLogger()
            .child('session')
            .info('session.create.completed', { sessionId, provider: turn.titleAdapter.id })
        }
        // 0064 continuity — fork/handoff 도착 물질화(lineage + fork 만 display 복사).
        // fork 복사가 원본 idx 를 보존하므로 아래 user 발화 영속(MAX(idx)+1)보다 먼저 실행해
        // 새 발화가 복사 이력 뒤로 정렬되게 한다.
        if (turn.lineage) {
          this.onContinuityArrival?.({
            childSessionId: sessionId,
            parentSessionId: turn.lineage.parentSessionId,
            relation: turn.lineage.relation,
            createdAt: now
          })
        }
        // 0067 AC6: user row 영속은 echo 커밋(commitUserMessage) 단일 경로 — 여기서는 세션
        // 메타(preview/provider_key/title)만 선반영해 nav 표시를 즉시 세운다.
        if (turn.pendingUserText) {
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
        // content(FTS 캐시) 기록은 메시지 마감 시 1회(finalizeAssistantMessage, 0107) —
        // 여기서는 누적과 사이드바 프리뷰 라이브 갱신만 한다.
        if (ev.parentToolRunId === undefined) {
          turn.assistantText += ev.message.text
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
        // SDK 네이티브 압축 완료 경계(0064) — 재로드 후에도 표시되도록 파트로 영속한다.
        if (!turn.dbSessionId) break
        const id = this.ensureAssistantMessage(turn, turn.dbSessionId)
        this.db.appendPart({
          messageId: id,
          type: 'compact_boundary',
          toolRunId: null,
          payloadJson: JSON.stringify({
            ...(ev.trigger !== undefined ? { trigger: ev.trigger } : {}),
            ...(ev.preTokens !== undefined ? { preTokens: ev.preTokens } : {}),
            ...(ev.postTokens !== undefined ? { postTokens: ev.postTokens } : {})
          })
        })
        break
      }
      case 'subagent.task': {
        // 라이브 메타는 transient(영속은 부모 Task tool_result 의 subagentMeta) — 단, 백그라운드
        // 완료 통지(0143)만 파트로 영속한다: settled + background(main 권위 게이팅) 일 때
        // subagent_notice 를 현 assistant 메시지에 append 해 재로드 후에도 동일 위치에 렌더된다.
        // 중복은 구조적으로 차단된다 — enrich 는 트래커 관측(settled 해제 전) 1회만 부여된다.
        if (!turn.dbSessionId) break
        if (ev.phase !== 'settled' || ev.background !== true) break
        const id = this.ensureAssistantMessage(turn, turn.dbSessionId)
        // 파트 내용은 renderer 와 같은 빌더로 만든다(0149) — 라이브/재로드 동치의 전제.
        // payload 에서 type 은 뺀다(별도 컬럼이 들고 있고, loadParts 가 재조립한다).
        const { type, ...noticePayload } = subagentNoticePart(ev)
        this.db.appendPart({
          messageId: id,
          type,
          toolRunId: ev.toolUseId,
          payloadJson: JSON.stringify(noticePayload)
        })
        break
      }
      case 'telemetry': {
        // 턴 종료 — 진행 중 assistant 메시지를 마감하고 다음 턴 대비 reset 한다. 사용량 적재(turn_usage
        // 원장)·비용 방출은 usage 구독자가, 제목 생성은 title 구독자가 버스에서 먼저 소비한다(0062).
        // 등록 순서(usage→history)가 usage 의 currentAssistantMessageId 링크를 이 reset 전에 보장한다.
        this.finalizeTurn(turn)
        break
      }
      // message.delta/message.reasoning.delta/turn.retrying 은 transient(미저장).
      // permission.* 는 별도 row 없음. subagent.task 는 위 통지 파트 외 transient — 메타 영속은
      // 부모 Task tool_result 의 subagentMeta(위 tool.call.completed)가 담당한다. activity 투영은
      // sendChatEvent 직행이라 여기 도달하지 않는다(도달해도 case 부재 = no-op).
    }
  }
}
