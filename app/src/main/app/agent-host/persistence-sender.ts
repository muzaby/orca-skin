// 턴 저장 스트림의 보내는 끝 (0324 EP-15 · AR-13 · SD-07 · MD-09 · AC39·AC40·AC44).
//
// 실행 쪽 코드가 부르던 저장 입력(`HistoryWriter` 의 메서드 자리 9곳)을 같은 모양으로 받아 피어 포트로
// 보낸다. 규칙(EP-15 규칙 칸):
// - 턴 이벤트·계획 검토 입력: 보내고 기다리지 않는다. 화면 중계는 저장을 기다리지 않는다(D-039).
// - 산출물 참조를 싣는 이벤트(도구 완료의 게시 영수증 · 출력 파일 담기): DB 가 확인한 참조만 화면에 실을
//   수 있어 응답을 기다리고, 같은 턴의 뒤 중계는 그 뒤로 줄을 선다(순서 보존 — 구현 보고 PLAN_GAP).
// - 질문 답: 실행 쪽 턴 상태(`openToolRuns`·`askPendingIds`·`pendingAskAnswers`)를 고치고
//   `tool.call.completed` 를 중계한 뒤, 데이터 호스트에는 결과만 보낸다(MD-09).
// - 사용자 메시지 커밋: DB 가 만든 메시지 id 를 응답으로 받는다.
// - 백그라운드 기록: 응답(기록 완료) 뒤에만 공개한다.
// - 저장 실패 통지: 그 턴을 오류로 끝내고 이후 그 턴의 입력을 보내지 않는다.
// - 피어 포트 닫힘(데이터 호스트 사망): 활성 턴을 모두 오류로 끝낸다. 기다리던 커밋은 실패한다(AC44).
//
// 세션 id 는 하네스가 준다 — 저장이 정하던 `turn.dbSessionId` 를 실행 쪽도 같은 이벤트에서 정한다.

import type { NormalizedEvent, TurnFailureReceipt } from '../../../shared/ipc'
import {
  assistantMessageId,
  PART_EVENT_TYPES,
  type PartEventType
} from '../../../shared/message-id'
import type { ClientRef } from '../../contracts/client'
import type { TurnContext } from '../../contracts/turn'
import { artifactReceiptId } from '../../features/history/artifact-receipt'
import type { HistoryWriter } from '../../features/history/writer'
import type { TurnPersistSink } from '../../features/chat/turn-sinks'
import type { PeerLink } from '../../infra/ipc/peer-link'
import {
  TURN_BEGIN_FIELDS,
  TURN_LIVE_FIELDS,
  type TurnAskAnswer,
  type TurnBegin,
  type UserCommitResult
} from '../../../shared/peer-protocol'

export interface PersistenceSenderDeps {
  newId(): string
  link: Pick<PeerLink<'agent'>, 'notify' | 'request' | 'onClosed'>
  // 화면 중계 — 그 턴의 순서대로 부른다.
  send(owner: ClientRef, ev: NormalizedEvent): void
  // 저장이 실패한 턴·데이터 호스트를 잃은 턴을 끝낸다(런타임 취소 + 오류 이벤트 1).
  failTurn(turn: TurnContext<ClientRef>, message: string): void
}

export interface PersistenceSender extends TurnPersistSink<ClientRef> {
  // 버스 구독(critical) — 저장 스트림으로 보낸다.
  onTurnEvent(turn: TurnContext<ClientRef>, ev: NormalizedEvent): void
  // 버스 구독(격리) — 화면 중계. 확인을 기다리는 이벤트가 있으면 그 뒤로 줄을 선다.
  relay(turn: TurnContext<ClientRef>, ev: NormalizedEvent): void
  persistProviderEvent(
    event: Parameters<HistoryWriter['persistProviderEvent']>[0],
    committed: () => void
  ): void
  forgetProviderSession(sessionId: string): void
  // 데이터 호스트가 보낸 통지(`turn.persistFailed`).
  onNotify(method: string, payload: unknown): void
}

export const PERSIST_PEER_LOST = '데이터 호스트와의 연결이 끊겨 턴을 끝냈습니다.'

interface TurnState {
  key: string
  turn: TurnContext<ClientRef>
  live: Record<string, unknown>
  // 확인을 기다리는 산출물 이벤트가 있으면 그 뒤 중계가 여기 줄을 선다.
  pending: number
  queue: NormalizedEvent[]
  failed: boolean
  messageKey?: string
  currentUserKey?: string
  callKeys: Map<string, string>
  boundaryKeys: Map<string, string>
}

function pick(turn: object, keys: readonly string[]): Record<string, unknown> {
  const source = turn as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of keys) if (source[key] !== undefined) out[key] = structuredClone(source[key])
  return out
}

function changed(previous: Record<string, unknown>, next: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)])
  for (const key of keys) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) return true
  }
  return false
}

function needsConfirmation(ev: NormalizedEvent): boolean {
  if (ev.type === 'output.captured') return true
  if (ev.type === 'tool.call.completed') return artifactReceiptId(ev.result) !== null
  return false
}

type PartEvent = Extract<NormalizedEvent, { type: PartEventType }>

const partEventTypes = new Set<NormalizedEvent['type']>(PART_EVENT_TYPES)

function isPartEvent(ev: NormalizedEvent): ev is PartEvent {
  return partEventTypes.has(ev.type)
}

function ownerKeyOf(state: TurnState, ev: PartEvent): string | undefined {
  if (ev.type === 'tool.call.completed') return state.callKeys.get(ev.toolRunId)
  if (ev.type === 'response.boundary' && ev.boundary.phase !== 'begin') {
    return state.boundaryKeys.get(ev.boundary.id)
  }
  return undefined
}

export function createPersistenceSender(deps: PersistenceSenderDeps): PersistenceSender {
  let seq = 0
  const states = new WeakMap<TurnContext<ClientRef>, TurnState>()
  const byKey = new Map<string, TurnState>()

  const stateOf = (turn: TurnContext<ClientRef>): TurnState => {
    let state = states.get(turn)
    if (state) return state
    const backend = (turn as { titleAdapter?: { id?: string } }).titleAdapter?.id ?? ''
    state = {
      key: `turn_${++seq}`,
      turn,
      live: pick(turn, TURN_LIVE_FIELDS),
      pending: 0,
      queue: [],
      failed: false,
      callKeys: new Map(),
      boundaryKeys: new Map()
    }
    states.set(turn, state)
    byKey.set(state.key, state)
    const begin: TurnBegin = {
      turnKey: state.key,
      backend,
      fields: { ...pick(turn, TURN_BEGIN_FIELDS), ...state.live }
    }
    deps.link.notify('turn.begin', begin)
    return state
  }

  // 바뀐 도중 필드가 있으면 다음 입력에 싣는다.
  const envelope = (state: TurnState): { turnKey: string; fields?: Record<string, unknown> } => {
    const live = pick(state.turn, TURN_LIVE_FIELDS)
    if (!changed(state.live, live)) return { turnKey: state.key }
    state.live = live
    return { turnKey: state.key, fields: live }
  }

  const fail = (state: TurnState, message: string): void => {
    if (state.failed) return
    state.failed = true
    state.queue = []
    byKey.delete(state.key)
    deps.failTurn(state.turn, message)
  }

  const flush = (state: TurnState): void => {
    while (!state.pending && state.queue.length > 0) {
      const ev = state.queue.shift()!
      deps.send(state.turn.owner, ev)
    }
  }

  const relay = (turn: TurnContext<ClientRef>, ev: NormalizedEvent): void => {
    const state = states.get(turn)
    if (state?.failed && ev.type === 'error' && ev.failure) return
    if (!state || (!state.pending && state.queue.length === 0)) {
      deps.send(turn.owner, ev)
    } else if (!state.failed) {
      state.queue.push(ev)
    }
  }

  deps.link.onClosed(() => {
    for (const state of [...byKey.values()]) fail(state, PERSIST_PEER_LOST)
  })

  return {
    onTurnEvent(turn, ev) {
      // 세션 id 는 하네스가 준다 — 제목 생성·중계보다 먼저 실행 쪽 사본에 둔다(MD-09).
      if (ev.type === 'session.updated') turn.dbSessionId = ev.sessionId
      // 답을 이미 채운 질문 도구에 실제 결과가 늦게 오면 저장된 답으로 바꾼다 — 답을 아는 쪽은 실행 쪽
      // 턴 상태뿐이다(MD-09). 바꾸지 않으면 빈 결과가 저장된 답과 화면의 답을 덮는다.
      if (ev.type === 'tool.call.completed') {
        const resolved = turn.askResolved.get(ev.toolRunId)
        if (resolved) {
          ev.result = {
            answers: resolved.answers,
            ...(resolved.response !== undefined ? { response: resolved.response } : {})
          }
        }
      }
      const state = stateOf(turn)
      // Receipt-bearing errors were already written by the acknowledged request.
      if (state.failed || (ev.type === 'error' && ev.failure)) return
      if (ev.type === 'message.delta' || ev.type === 'message.reasoning.delta') {
        ev.messageKey ??= state.messageKey ??= assistantMessageId(deps.newId())
      } else if (isPartEvent(ev)) {
        if (ev.messageKey === undefined) {
          const owner = ownerKeyOf(state, ev)
          ev.messageKey = owner ?? (state.messageKey ??= assistantMessageId(deps.newId()))
          if (owner !== undefined) ev.messageKeySource = 'owner'
        }
        if (ev.type === 'tool.call.started' && !state.callKeys.has(ev.toolRunId)) {
          state.callKeys.set(ev.toolRunId, ev.messageKey)
        }
        if (ev.type === 'response.boundary' && ev.boundary.phase === 'begin') {
          state.boundaryKeys.set(ev.boundary.id, ev.messageKey)
        }
      }
      if (!needsConfirmation(ev)) {
        if (ev.type === 'tool.call.completed') delete (ev as { artifact?: unknown }).artifact
        deps.link.notify('turn.event', { ...envelope(state), ev })
        if (ev.type === 'telemetry') delete state.messageKey
        return
      }
      // 어댑터 입력의 산출물 참조는 권위가 없다 — DB 가 확인한 참조로 바꾼 뒤 중계한다.
      state.pending += 1
      void deps.link
        .request('turn.artifactEvent', { ...envelope(state), ev })
        .then(
          (artifact) => {
            if (artifact) (ev as { artifact?: unknown }).artifact = artifact
            else delete (ev as { artifact?: unknown }).artifact
          },
          () => {
            delete (ev as { artifact?: unknown }).artifact
          }
        )
        .finally(() => {
          state.pending -= 1
          flush(state)
        })
    },
    relay,
    persist(turn, ev) {
      // 계획 검토 도구 입력 — 턴 이벤트와 같은 순서 큐로 간다.
      const state = stateOf(turn)
      if (!state.failed) deps.link.notify('turn.event', { ...envelope(state), ev })
    },
    flushAskAnswers(turn) {
      const state = states.get(turn)
      const answers: TurnAskAnswer[] = []
      for (let answerIndex = 0; answerIndex < turn.pendingAskAnswers.length;) {
        const a = turn.pendingAskAnswers[answerIndex]!
        const pendingIndex = turn.askPendingIds.indexOf(a.toolUseId)
        if (pendingIndex < 0) {
          answerIndex += 1
          continue
        }
        const toolUseId = a.toolUseId
        turn.pendingAskAnswers.splice(answerIndex, 1)
        turn.askPendingIds.splice(pendingIndex, 1)
        const output = {
          answers: a.answers,
          ...(a.response !== undefined ? { response: a.response } : {})
        }
        turn.askResolved.set(toolUseId, a)
        const parentToolRunId = turn.openToolRuns.get(toolUseId)?.parentToolRunId
        // 답변이 채워진 Ask 는 더 이상 열린 실행이 아니다 — 중단 시 abort 결과로 덮지 않는다.
        turn.openToolRuns.delete(toolUseId)
        const ownerKey = state?.callKeys.get(toolUseId)
        const messageKey = ownerKey ?? state?.messageKey
        answers.push({
          toolUseId,
          output,
          ...(messageKey !== undefined ? { messageKey } : {}),
          ...(parentToolRunId ? { parentToolRunId } : {})
        })
        relay(turn, {
          type: 'tool.call.completed',
          sessionId: turn.dbSessionId ?? '',
          toolRunId: toolUseId,
          result: output,
          isError: false,
          ...(messageKey !== undefined ? { messageKey } : {}),
          ...(ownerKey !== undefined ? { messageKeySource: 'owner' as const } : {}),
          ...(parentToolRunId ? { parentToolRunId } : {})
        })
      }
      if (answers.length === 0) return
      const activeState = state ?? stateOf(turn)
      if (!activeState.failed) {
        deps.link.notify('turn.askAnswers', { ...envelope(activeState), answers })
      }
    },
    async commitFailure(turn, event, occurrence) {
      const state = stateOf(turn)
      if (state.failed || !turn.dbSessionId || turn.dbSessionId !== event.sessionId) return null
      const { ownerUserMessageKey } = occurrence
      const boundaryKey = occurrence.responseBoundaryId
        ? state.boundaryKeys.get(occurrence.responseBoundaryId)
        : undefined
      const assistantMessageKey =
        boundaryKey ??
        (state.currentUserKey === ownerUserMessageKey
          ? (state.messageKey ??= assistantMessageId(deps.newId()))
          : assistantMessageId(deps.newId()))
      const failure: TurnFailureReceipt = {
        ...occurrence,
        assistantMessageKey
      }
      const payload = {
        ...envelope(state),
        ev: { ...event, messageKey: assistantMessageKey, failure }
      }
      const request = (): Promise<unknown> => deps.link.request('turn.failureEvent', payload)
      try {
        // The previous write can already be committed if only its reply was lost.
        const receipt = (await request().catch((error: unknown) => {
          if (state.failed) throw error
          return request()
        })) as TurnFailureReceipt | null
        if (state.failed) return null
        if (
          !receipt ||
          receipt.failureId !== failure.failureId ||
          receipt.occurredAt !== failure.occurredAt ||
          receipt.assistantMessageKey !== assistantMessageKey ||
          receipt.responseBoundaryId !== failure.responseBoundaryId ||
          receipt.ownerUserMessageKey !== ownerUserMessageKey
        )
          throw new Error('대화 실패 영수증을 확인할 수 없습니다.')
        return receipt
      } catch (error) {
        fail(state, error instanceof Error ? error.message : PERSIST_PEER_LOST)
        return null
      }
    },
    async commitUserMessage(turn, batch) {
      const state = stateOf(turn)
      if (state.failed) return null
      const result = (await deps.link.request('turn.commitUser', {
        ...envelope(state),
        batch
      })) as UserCommitResult | null
      if (result?.created) {
        delete state.messageKey
        state.currentUserKey = batch.messageKey
      }
      return result?.id ?? null
    },
    finalizeTurn(turn) {
      const state = states.get(turn)
      if (!state) return
      states.delete(turn)
      byKey.delete(state.key)
      if (!state.failed) deps.link.notify('turn.end', envelope(state))
    },
    persistProviderEvent(event, committed) {
      void deps.link.request('provider.event', event).then(
        () => committed(),
        () => undefined
      )
    },
    forgetProviderSession(sessionId) {
      deps.link.notify('provider.forget', { sessionId })
    },
    onNotify(method, payload) {
      if (method !== 'turn.persistFailed') return
      const { turnKey, message } = payload as { turnKey: string; message: string }
      const state = byKey.get(turnKey)
      if (state) fail(state, message)
    }
  }
}
