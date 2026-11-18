// 메시지를 "턴"으로 묶는 순수 헬퍼. 한 에이전트 응답이 텍스트↔툴콜 교대로 여러 assistant
// 메시지로 쪼개져도, 복사/시간 메타는 사용자 턴·에이전트 턴 단위로 한 번만 찍는다 (transcript 렌더).

import { partsAttachments, partsDiffRequirements, partsText } from './parts'
import type { Message } from '../reducer/chatReducer'

export interface TranscriptProjectionOptions {
  showAutomaticFeeds?: boolean
}

function visibleMessage(
  message: Message,
  { showAutomaticFeeds = false }: TranscriptProjectionOptions
): Message | undefined {
  if (message.role !== 'user') return message
  const parts = message.parts.filter((part) => {
    if (part.type !== 'text' || !part.origin) return true
    return showAutomaticFeeds
  })
  if (parts.length === message.parts.length) return message
  const hasContent =
    partsText(parts).trim() || partsAttachments(parts).length || partsDiffRequirements(parts).length
  return hasContent ? { ...message, parts } : undefined
}

export interface Turn {
  role: 'user' | 'assistant'
  messages: Message[]
  // 원본 messages 배열에서 이 턴 첫 메시지의 인덱스 (React key 안정용).
  startIndex: number
}

// 연속 동일 role 메시지를 한 턴으로 그룹핑. 순서 보존.
export function groupTurns(messages: Message[], options: TranscriptProjectionOptions = {}): Turn[] {
  const turns: Turn[] = []
  for (let i = 0; i < messages.length; i++) {
    // 원본 이력과 index/key는 보존하고, 혼합 메시지의 자동 text part만 제외한다.
    // 출처 없는 수기 태그·첨부 및 assistant/tool 출력은 분류하지 않는다.
    const m = visibleMessage(messages[i], options)
    if (!m) continue
    const last = turns[turns.length - 1]
    if (last && last.role === m.role) {
      last.messages.push(m)
    } else {
      turns.push({ role: m.role, messages: [m], startIndex: i })
    }
  }
  return turns
}

// 두 Turn 이 렌더 관점에서 동일한가 — React.memo 비교자용(순수). groupTurns 가 호출마다
// 새 Turn 객체를 만들므로 내용으로 비교한다. reducer 는 과거 Message 객체의 참조를 보존
// (appendAssistantPart 는 마지막 메시지만 새 객체로 교체)하므로 메시지는 identity 비교로 충분.
export function turnEquals(a: Turn, b: Turn): boolean {
  if (a.role !== b.role || a.startIndex !== b.startIndex) return false
  if (a.messages.length !== b.messages.length) return false
  for (let i = 0; i < a.messages.length; i++) {
    if (a.messages[i] !== b.messages[i]) return false
  }
  return true
}

// 교환(exchange) — user 턴 1개 + 뒤따르는 assistant 턴들. transcript 렌더의 그룹 단위이자
// 예약공간(min-height 앵커, rendering.md §1.8)의 적용 대상. 경계는 영원히 안정적이다:
// 새 메시지는 마지막 교환을 확장하거나 새 교환을 추가할 뿐, 기존 교환의 DOM 을 재부모화
// 하지 않는다(ToolCard 열림·shiki 상태 보존). 세션 선두의 assistant 턴은 user 없는 교환.
export interface Exchange {
  // 교환 첫 턴(보통 user)의 startIndex — React key 안정용.
  startIndex: number
  turns: Turn[]
}

export function groupExchanges(
  messages: Message[],
  options: TranscriptProjectionOptions = {}
): Exchange[] {
  return groupExchangesFrom(messages, 0, (message) => visibleMessage(message, options))
}

// 그룹화 핵심 — `start` 부터 새 상태로 묶고 원래 색인을 `startIndex` 로 쓴다. `groupExchanges`(전체·캐시
// 없음)와 증분 grouper(재그룹 구간·파생 메시지 캐시)가 같은 핵심을 쓴다(0325 EP-3).
function groupExchangesFrom(
  messages: Message[],
  start: number,
  visible: (message: Message) => Message | undefined
): Exchange[] {
  const exchanges: Exchange[] = []
  let turn: Turn | undefined
  for (let i = start; i < messages.length; i++) {
    const m = visible(messages[i])
    if (!m) continue
    if (turn && turn.role === m.role) {
      turn.messages.push(m)
      continue
    }
    turn = { role: m.role, messages: [m], startIndex: i }
    const last = exchanges[exchanges.length - 1]
    if (turn.role === 'user' || !last) exchanges.push({ startIndex: i, turns: [turn] })
    else last.turns.push(turn)
  }
  return exchanges
}

export type ExchangeGrouper = (
  messages: Message[],
  options?: TranscriptProjectionOptions
) => Exchange[]

// 증분 그룹화 (0325 D-030 · D-033 · EP-3). 결과는 언제나 `groupExchanges` 전체 결과와 같다.
// - 다음 exchange 시작이 첫 변경 지점보다 **작은** exchange 만 이전 객체로 재사용한다 — 같으면 그 경계
//   메시지가 숨거나 바뀌어 경계가 사라질 수 있다.
// - 재그룹은 첫 변경 지점과 첫 비재사용 exchange 시작 중 앞선 위치부터 새 상태로 묶는다 — 첫 exchange
//   앞의 숨은 메시지가 보이게 되는 경우를 읽는다.
// - 다시 묶은 exchange·Turn 중 내용이 같은 것은 이전 객체로 돌려준다. 파생 user 메시지(자동 피드를 뺀
//   객체)는 원본 참조·표시 옵션별로 재사용해 `turnEquals` 가 참이 된다.
export function createExchangeGrouper(): ExchangeGrouper {
  let previousMessages: Message[] | undefined
  let previousShow = false
  let previous: Exchange[] = []
  // ⑧ 표시 옵션별 파생 메시지 — 숨김은 `null`.
  const derived = {
    hidden: new WeakMap<Message, Message | null>(),
    shown: new WeakMap<Message, Message | null>()
  }
  return (messages, options = {}) => {
    const show = options.showAutomaticFeeds ?? false
    // ① 같은 입력 → 같은 결과
    if (messages === previousMessages && show === previousShow) return previous
    const cache = show ? derived.shown : derived.hidden
    const visible = (message: Message): Message | undefined => {
      if (message.role !== 'user') return message
      const hit = cache.get(message)
      if (hit !== undefined) return hit ?? undefined
      const out = visibleMessage(message, { showAutomaticFeeds: show })
      cache.set(message, out ?? null)
      return out
    }
    let reuse = 0
    let start = 0
    // ④ 처음·옵션 변경·축소 → 전부 다시 묶는다
    if (
      previousMessages !== undefined &&
      show === previousShow &&
      messages.length >= previousMessages.length
    ) {
      // ② 첫 변경 지점 — 참조 비교(할당 없음, 0325 B8)
      let firstChange = 0
      while (
        firstChange < previousMessages.length &&
        previousMessages[firstChange] === messages[firstChange]
      )
        firstChange++
      // ③ 재사용 — 다음 exchange 시작 < 첫 변경
      while (reuse + 1 < previous.length && previous[reuse + 1].startIndex < firstChange) reuse++
      // ⑤ 재그룹 시작 = min(첫 변경, 첫 비재사용 exchange 시작)
      start =
        reuse < previous.length ? Math.min(firstChange, previous[reuse].startIndex) : firstChange
    }
    const regrouped = groupExchangesFrom(messages, start, visible)
    // ⑥ 동치 복원 — 같은 startIndex 의 이전 exchange·Turn
    const byStart = new Map<number, Exchange>()
    for (let i = reuse; i < previous.length; i++) byStart.set(previous[i].startIndex, previous[i])
    const restored = regrouped.map((exchange) => {
      const before = byStart.get(exchange.startIndex)
      if (!before) return exchange
      if (exchangeEquals(before, exchange)) return before
      const turns = exchange.turns.map((turn) => {
        const match = before.turns.find((candidate) => candidate.startIndex === turn.startIndex)
        return match && turnEquals(match, turn) ? match : turn
      })
      return { ...exchange, turns }
    })
    const result = reuse > 0 ? previous.slice(0, reuse).concat(restored) : restored
    previousMessages = messages
    previousShow = show
    previous = result
    return result
  }
}

// 두 Exchange 가 렌더 관점에서 동일한가 — React.memo 비교자용(순수). turnEquals 와 동형.
export function exchangeEquals(a: Exchange, b: Exchange): boolean {
  if (a.startIndex !== b.startIndex || a.turns.length !== b.turns.length) return false
  for (let i = 0; i < a.turns.length; i++) {
    if (!turnEquals(a.turns[i], b.turns[i])) return false
  }
  return true
}

// 턴의 복사 대상 텍스트 — 각 메시지의 text 파트를 합치고 빈 값은 제외한다.
export function turnCopyText(turn: Turn): string {
  return turn.messages
    .map((m) => partsText(m.parts))
    .filter((c) => c.trim() !== '')
    .join('\n\n')
}
