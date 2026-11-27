// 턴 저장 스트림의 받는 끝 (0324 EP-15 · AR-13 · SD-07 · MD-09 · AC39 · AC29′).
//
// 에이전트 호스트가 피어 포트로 보낸 턴 저장 입력을 도착 순서대로 지금의 저장 코드(`UsageTracker` →
// `HistoryWriter`)에 넣는다 — 한 포트의 순서가 저장 순서다. 턴마다 저장 쪽 턴 상태 사본(MD-09)을 둔다:
// 시작 때 받은 정적 필드 + 저장기가 스스로 바꾸는 필드(현재 어시스턴트 메시지·응답 경계·계획 도구 입력).
//
// - 저장이 던지면 그 턴을 실패로 표시하고 에이전트 호스트에 알린다(`turn.persistFailed`). 이후 그
//   턴의 입력은 버린다 — 에이전트 호스트가 그 턴을 오류로 끝낸다(D-039 · B21).
// - 에이전트 호스트가 죽으면(피어 포트 닫힘) 열린 턴을 지금의 복구 규칙으로 바로 마감한다(AC29′).
//
// 받는 분기의 동기 구간은 피어 링크가 `perf.stall`(`source:'peer'`)로 잰다(EP-2′).

import type { NormalizedEvent } from '../../../shared/ipc'
import type {
  PeerMethod,
  TurnAskAnswer,
  TurnBegin,
  UserCommitBatch
} from '../../../shared/peer-protocol'
import type { TurnContext } from '../../contracts/turn'
import { resolveAgentProfile } from '../../features/agents/profiles'
import { recoverSessionHistory } from '../../features/chat/recovery'
import { HistoryWriter } from '../../features/history/writer'
import { copyForkDisplay } from '../../features/history/fork-display'
import { materializeContinuityArrival } from '../../features/orchestration/fork'
import type { UsageTracker } from '../../features/usage/tracker'
import type { DbQueries } from '../../infra/db'
import { getLogger } from '../../infra/log'
import { errorMessage } from '../../infra/errors'

export interface PersistenceReceiver {
  request(method: PeerMethod, payload: unknown): unknown
  notify(method: PeerMethod, payload: unknown): void
  // 에이전트 호스트가 죽었다 — 열린 턴을 마감한다.
  peerClosed(): void
  forgetSession(sessionId: string): void
}

export interface PersistenceReceiverDeps {
  db: DbQueries
  usage(): Pick<UsageTracker, 'recordTurnUsage'> | undefined
  notifyAgent(method: 'turn.persistFailed', payload: { turnKey: string; message: string }): void
  clock?: () => number
  writer?: HistoryWriter
}

function storageTurn(begin: TurnBegin): TurnContext {
  return {
    ...begin.fields,
    titleAdapter: { id: begin.backend },
    currentAssistantMessageId: null,
    currentAssistantMessageKey: undefined,
    assistantText: '',
    openToolRuns: new Map(),
    askPendingIds: [],
    pendingAskAnswers: [],
    askResolved: new Map(),
    planToolInputs: new Map(),
    pendingPlanToolCalls: []
  } as unknown as TurnContext
}

export function createPersistenceReceiver(deps: PersistenceReceiverDeps): PersistenceReceiver {
  const writer =
    deps.writer ??
    new HistoryWriter(
      deps.db,
      (kind) => resolveAgentProfile(kind).persistResponseBoundaries,
      (arrival) => materializeContinuityArrival(deps.db, arrival, copyForkDisplay),
      deps.db.artifacts
    )
  const turns = new Map<string, TurnContext>()
  const failed = new Set<string>()
  const log = getLogger().child('persistence')

  const fail = (turnKey: string, error: unknown): void => {
    failed.add(turnKey)
    turns.delete(turnKey)
    const message = errorMessage(error)
    log.error('persistence.turn.failed', error, { turnKey })
    deps.notifyAgent('turn.persistFailed', { turnKey, message })
  }

  // 정적·도중 필드를 반영하고 그 턴의 저장 상태를 돌려준다. 실패했거나 모르는 턴이면 undefined.
  const turnOf = (payload: {
    turnKey: string
    fields?: Record<string, unknown>
  }): TurnContext | undefined => {
    if (failed.has(payload.turnKey)) return undefined
    const turn = turns.get(payload.turnKey)
    if (turn && payload.fields) Object.assign(turn, payload.fields)
    return turn
  }

  // 사용량 → 이력 순서(SD-05′) — 사용량이 이력의 `currentAssistantMessageId` 를 리셋 전에 읽는다.
  const persistEvent = (turnKey: string, turn: TurnContext, ev: NormalizedEvent): boolean => {
    try {
      if (ev.type === 'telemetry') deps.usage()?.recordTurnUsage(turn, ev)
      writer.persist(turn, ev)
      return true
    } catch (error) {
      fail(turnKey, error)
      return false
    }
  }

  return {
    request(method, payload) {
      switch (method) {
        case 'turn.commitUser': {
          const input = payload as {
            turnKey: string
            fields?: Record<string, unknown>
            batch: UserCommitBatch
          }
          const turn = turnOf(input)
          if (!turn) return null
          try {
            return writer.commitUserMessage(turn, input.batch)
          } catch (error) {
            fail(input.turnKey, error)
            return null
          }
        }
        case 'turn.failureEvent': {
          const input = payload as {
            turnKey: string
            fields?: Record<string, unknown>
            ev: Extract<NormalizedEvent, { type: 'error' }>
          }
          const turn = turnOf(input)
          try {
            return writer.commitFailure(turn, input.ev)
          } catch (error) {
            if (turn) fail(input.turnKey, error)
            return null
          }
        }
        case 'turn.artifactEvent': {
          const input = payload as {
            turnKey: string
            fields?: Record<string, unknown>
            ev: NormalizedEvent
          }
          const turn = turnOf(input)
          if (!turn) return null
          if (!persistEvent(input.turnKey, turn, input.ev)) return null
          return (input.ev as { artifact?: unknown }).artifact ?? null
        }
        case 'provider.event': {
          const event = payload as Parameters<HistoryWriter['persistProviderEvent']>[0]
          // 기록한 뒤에만 응답한다 — 세션이 아직 없으면 저장기가 보류했다가 세션 생성 뒤 기록한다.
          return new Promise<boolean>((resolve) =>
            writer.persistProviderEvent(event, () => resolve(true))
          )
        }
        default:
          throw new Error(`데이터 호스트가 받지 않는 요청: ${method}`)
      }
    },
    notify(method, payload) {
      switch (method) {
        case 'turn.begin': {
          const begin = payload as TurnBegin
          failed.delete(begin.turnKey)
          turns.set(begin.turnKey, storageTurn(begin))
          return
        }
        case 'turn.event': {
          const input = payload as {
            turnKey: string
            fields?: Record<string, unknown>
            ev: NormalizedEvent
          }
          const turn = turnOf(input)
          if (turn) persistEvent(input.turnKey, turn, input.ev)
          return
        }
        case 'turn.askAnswers': {
          const input = payload as {
            turnKey: string
            fields?: Record<string, unknown>
            answers: TurnAskAnswer[]
          }
          const turn = turnOf(input)
          if (!turn) return
          try {
            writer.recordAskAnswers(turn, input.answers)
          } catch (error) {
            fail(input.turnKey, error)
          }
          return
        }
        case 'turn.end': {
          const input = payload as { turnKey: string; fields?: Record<string, unknown> }
          const turn = turnOf(input)
          failed.delete(input.turnKey)
          if (!turn) return
          turns.delete(input.turnKey)
          try {
            writer.finalizeTurn(turn)
          } catch (error) {
            log.error('persistence.turn.finalize-failed', error, { turnKey: input.turnKey })
          }
          return
        }
        case 'provider.forget':
          writer.forgetProviderSession((payload as { sessionId: string }).sessionId)
          return
        default:
          log.warn('persistence.notify.unknown', { method })
      }
    },
    peerClosed() {
      const open = [...turns.values()]
      turns.clear()
      failed.clear()
      for (const turn of open) {
        try {
          // 저장기로 마감하지 않는다 — 마감은 메시지를 완료로 표시하고, 복구는 미완료 메시지에서만
          // 끊긴 도구 호출을 찾는다. 앱이 죽었다 다시 뜬 때와 같은 규칙 하나로 정리한다.
          if (turn.dbSessionId) recoverSessionHistory(deps.db, { sessionId: turn.dbSessionId })
        } catch (error) {
          log.error('persistence.peer-closed.recover-failed', error, {
            sessionId: turn.dbSessionId
          })
        }
      }
    },
    forgetSession(sessionId) {
      writer.forgetProviderSession(sessionId)
    }
  }
}
