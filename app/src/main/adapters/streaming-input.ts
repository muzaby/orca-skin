// 세션-스코프 스트리밍 입력 (provider-runtime.md §3, 0067 장수명 채널).
//
// claude SDK 의 control 메서드(setPermissionMode/interrupt/setModel)와 다중 턴 입력은 "스트리밍
// 입력 모드"(prompt 가 AsyncIterable)에서만 열린다. 0067 이전에는 이 스트림이 턴-스코프(result
// 도착 시 close)였으나, 이제 **세션 수명** 동안 열려 후속 턴 프롬프트와 steer 를 같은 채널로
// push 한다 — generator 가 return 되면 SDK 세션이 닫히므로(서브프로세스 종료), close() 는 세션
// 폐기(LRU 축출·프로그램 종료·respawn 경계·에러)에서만 호출된다.
//
// 순수 모듈(electron 비의존) — generator 미종료 불변식의 단일 격리 지점이라 Vitest 로 운동한다.

import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources'

export type TurnInputContent = MessageParam['content']

interface SessionInputStream {
  // query({ prompt }) 에 넘기는 입력 스트림.
  stream: AsyncIterable<SDKUserMessage>
  // 사용자 메시지 1건(턴 프롬프트 또는 steer 배치)을 채널에 추가한다. content 는 텍스트 또는
  // content 블록 배열(이미지 포함 — 큐 구조 페이로드, 0067 AC5).
  // 주의: push 는 SDK 서브프로세스 stdin 으로 입력을 흘려보낼 뿐 — UI/영속 커밋은 CLI 가 소비
  // 후 되돌려주는 user echo(input.echo)로 확정한다(0060 D1·0067 AC6). SDK 는 이 AsyncIterable
  // 을 eager 하게 drain 하므로 pull ≠ 소비다.
  // uuid 는 orca 가 부여하는 상관키(PendingMessageQueue 아이템/배치 uuid) — echo 매칭 1차 키.
  //
  // 반환값(0151 AC3) = **로컬 스트림 수용 여부**뿐이다. closed 스트림이면 false 를 돌려주고
  // 호출자가 예약을 롤백할 수 있게 한다 — 구 계약(void)은 닫힌 스트림을 조용히 삼켜, 메시지가
  // "취소도 재시도도 안 되는" 상태로 굳었다. provider acceptance 의 증거가 **아니다**:
  // stdin 은 ack 없는 단방향이라 CLI 가 실제로 받았는지는 여기서 알 수 없다(그건 echo 몫).
  push(content: TurnInputContent, uuid?: string): boolean
  // 세션 폐기 시 호출 — generator 를 return 시켜 서브프로세스를 닫는다. 멱등.
  close(): void
}

// 주입 user 메시지 — uuid(orca 상관키) + priority 'next'(도구 경계 drain 클래스)를 명시한다.
// priority 기본값도 'next' 지만 CLI 버전 드리프트를 막기 위해 고정으로 싣는다(0060 D1). idle
// 채널에서는 다음 턴 프롬프트로(P2 픽업), busy 채널에서는 도구 경계에서(P1 drain) 소비된다 —
// 분기는 CLI 몫(0067 설계: 주입 로직은 SDK 역할).
function pendingUserMessage(content: TurnInputContent, uuid?: string): SDKUserMessage {
  return {
    type: 'user',
    message: { role: 'user', content },
    parent_tool_use_id: null,
    priority: 'next',
    ...(uuid !== undefined ? { uuid: uuid as SDKUserMessage['uuid'] } : {})
  }
}

// close() 까지 열려있는 세션 입력 스트림을 만든다. initial 배열은 스폰 선적재분 — [프렐류드
// (이월 배치)..., 본 프롬프트] 순서로 각자 개별 user 메시지가 된다(0067).
export function createSessionInputStream(
  initial: Array<{ content: TurnInputContent; uuid?: string }> = []
): SessionInputStream {
  let closed = false
  let wake: (() => void) | null = null
  const queue: SDKUserMessage[] = initial.map((m) => pendingUserMessage(m.content, m.uuid))

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
    push(content: TurnInputContent, uuid?: string): boolean {
      if (closed) return false
      queue.push(pendingUserMessage(content, uuid))
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
