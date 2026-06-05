// 턴-스코프 스트리밍 입력 (provider-runtime.md §3, PR③ 옵션 A).
//
// claude SDK 의 control 메서드(setPermissionMode/interrupt/setModel)는 "스트리밍 입력 모드"
// (prompt 가 AsyncIterable)에서만 열린다. 한 턴 동안만 Query 핸들을 살리기 위해, 이 턴의 user
// 메시지 1건을 yield 하고 **close() 까지 종료하지 않는** 입력 스트림을 만든다 — generator 가
// return 되면 SDK 세션이 닫히므로(서브프로세스 종료), 턴 진행 중에는 살아있어야 한다.
//
// 순수 모듈(electron 비의존) — generator 미종료 불변식의 단일 격리 지점이라 Vitest 로 운동한다.

import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'

export interface TurnInputStream {
  // query({ prompt }) 에 넘기는 입력 스트림.
  stream: AsyncIterable<SDKUserMessage>
  // 턴 종료(=result 도착) 또는 abort 시 호출 — generator 를 return 시켜 세션을 닫는다. 멱등.
  close(): void
}

// 이 턴의 텍스트 1건을 내보내고 close() 까지 열려있는 입력 스트림을 만든다.
export function createTurnInputStream(text: string): TurnInputStream {
  let closed = false
  let wake: (() => void) | null = null
  const queue: SDKUserMessage[] = [
    { type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null }
  ]

  async function* gen(): AsyncIterable<SDKUserMessage> {
    while (true) {
      while (queue.length > 0) yield queue.shift()!
      if (closed) return
      // 다음 입력(현 턴엔 없음) 또는 close() 까지 대기. close() race 가드 포함.
      await new Promise<void>((resolve) => {
        if (closed) {
          resolve()
          return
        }
        wake = resolve
      })
    }
  }

  return {
    stream: gen(),
    close(): void {
      closed = true
      wake?.()
      wake = null
    }
  }
}
