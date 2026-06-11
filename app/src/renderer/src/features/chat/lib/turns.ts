// 메시지를 "턴"으로 묶는 순수 헬퍼. 한 에이전트 응답이 텍스트↔툴콜 교대로 여러 assistant
// 메시지로 쪼개져도, 복사/시간 메타는 사용자 턴·에이전트 턴 단위로 한 번만 찍는다 (transcript 렌더).

import { partsText } from './parts'
import type { Message } from '../reducer/chatReducer'

export interface Turn {
  role: 'user' | 'assistant'
  messages: Message[]
  // 원본 messages 배열에서 이 턴 첫 메시지의 인덱스 (React key 안정용).
  startIndex: number
}

// 연속 동일 role 메시지를 한 턴으로 그룹핑. 순서 보존.
export function groupTurns(messages: Message[]): Turn[] {
  const turns: Turn[] = []
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
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

// 턴의 복사 대상 텍스트 — 각 메시지의 text 파트를 합치고 빈 값은 제외한다.
export function turnCopyText(turn: Turn): string {
  return turn.messages
    .map((m) => partsText(m.parts))
    .filter((c) => c.trim() !== '')
    .join('\n\n')
}
