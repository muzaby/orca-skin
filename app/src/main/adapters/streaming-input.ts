// 턴-스코프 스트리밍 입력 (provider-runtime.md §3, PR③ 옵션 A).
//
// claude SDK 의 control 메서드(setPermissionMode/interrupt/setModel)는 "스트리밍 입력 모드"
// (prompt 가 AsyncIterable)에서만 열린다. 한 턴 동안만 Query 핸들을 살리기 위해, 이 턴의 user
// 메시지 1건을 yield 하고 **close() 까지 종료하지 않는** 입력 스트림을 만든다 — generator 가
// return 되면 SDK 세션이 닫히므로(서브프로세스 종료), 턴 진행 중에는 살아있어야 한다.
//
// 순수 모듈(electron 비의존) — generator 미종료 불변식의 단일 격리 지점이라 Vitest 로 운동한다.

import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources'

export type TurnInputContent = MessageParam['content']

export interface ConsumedTurnInput {
  text: string
  message: SDKUserMessage
}

export interface TurnInputStreamOptions {
  // SDK 가 prompt AsyncIterable 을 pull 해 user 메시지를 실제 소비하는 순간 발화한다.
  onConsume?: (input: ConsumedTurnInput) => void
  nextInjectedInput?: () => string | undefined
}

export interface TurnInputStream {
  // query({ prompt }) 에 넘기는 입력 스트림.
  stream: AsyncIterable<SDKUserMessage>
  // 진행 중 턴에 텍스트 피드백을 추가한다. text-only 로 제한해 병합 규칙을 단순화한다.
  push(text: string): void
  // 턴 종료(=result 도착) 또는 abort 시 호출 — generator 를 return 시켜 세션을 닫는다. 멱등.
  close(): void
}

function userMessage(content: TurnInputContent): SDKUserMessage {
  return { type: 'user', message: { role: 'user', content }, parent_tool_use_id: null }
}

// 이 턴의 user 메시지 1건을 내보내고 close() 까지 열려있는 입력 스트림을 만든다.
export function createTurnInputStream(
  content: TurnInputContent,
  options: TurnInputStreamOptions = {}
): TurnInputStream {
  let closed = false
  let wake: (() => void) | null = null
  const queue: Array<SDKUserMessage | (() => string | undefined)> = [userMessage(content)]

  async function* gen(): AsyncIterable<SDKUserMessage> {
    while (true) {
      while (queue.length > 0) {
        const queued = queue.shift()!
        const next = typeof queued === 'function' ? queued() : queued
        if (next === undefined) continue
        const message = typeof next === 'string' ? userMessage(next) : next
        if (typeof message.message.content === 'string') {
          options.onConsume?.({ text: message.message.content, message })
        }
        yield message
      }
      if (closed) return
      // 다음 입력 또는 close() 까지 대기. close() race 가드 포함.
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
    push(text: string): void {
      if (closed) return
      void text
      queue.push(() => options.nextInjectedInput?.())
      wake?.()
      wake = null
    },
    close(): void {
      closed = true
      wake?.()
      wake = null
    }
  }
}
