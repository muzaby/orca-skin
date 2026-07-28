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

export interface TurnInputStream {
  // query({ prompt }) 에 넘기는 입력 스트림.
  stream: AsyncIterable<SDKUserMessage>
  // 진행 중 턴에 텍스트 피드백을 추가한다. text-only 로 제한해 병합 규칙을 단순화한다.
  //
  // pull 은 "SDK transport 가 텍스트를 받아간 시각"일 뿐 **모델이 그 메시지를 대화에 받아들인
  // 지점이 아니다**(transport 는 generator 를 eager drain 한다). 그래서 소비 콜백을 두지 않는다 —
  // 실제 소비 경계는 PostToolBatch 훅 / result 로 관측하고 TurnCoordinator 가 커밋한다(handoff 0060).
  //
  // 반환값 = 전달 수락 여부. 이미 close 된 스트림이면 false — 호출자가 조용한 유실(큐에만 남아
  // 다음 턴 첫 flush 를 오염시키던 버그)을 감지해 정리할 수 있게 한다.
  push(text: string): boolean
  // 턴 종료(=result 도착) 또는 abort 시 호출 — generator 를 return 시켜 세션을 닫는다. 멱등.
  close(): void
}

function userMessage(content: TurnInputContent): SDKUserMessage {
  return { type: 'user', message: { role: 'user', content }, parent_tool_use_id: null }
}

// 이 턴의 user 메시지 1건을 내보내고 close() 까지 열려있는 입력 스트림을 만든다.
export function createTurnInputStream(content: TurnInputContent): TurnInputStream {
  let closed = false
  let wake: (() => void) | null = null
  const queue: SDKUserMessage[] = [userMessage(content)]

  async function* gen(): AsyncIterable<SDKUserMessage> {
    while (true) {
      while (queue.length > 0) {
        yield queue.shift()!
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
    push(text: string): boolean {
      if (closed) return false
      queue.push(userMessage(text))
      wake?.()
      wake = null
      return true
    },
    close(): void {
      closed = true
      wake?.()
      wake = null
    }
  }
}
