// AskUserQuestionBroker — Claude Agent SDK 의 canUseTool(AskUserQuestion) 콜백과 renderer UI 를
// 잇는 Promise 다리(main 측). canUseTool 은 반환할 때까지 query() 실행을 일시 중지하므로,
// 질문을 renderer 로 surface 한 뒤 사용자의 응답이 도착할 때까지 Promise 를 보류한다.
//
// electron 비의존(순수 TS) — vitest 단위 테스트 대상. 실제 채널 전송/검증은 router 가 담당하고,
// 브로커는 requestId → resolver 매핑과 abort 정리만 책임진다.

import type { AskResult } from '../../shared/ipc'

interface Pending {
  resolve: (result: AskResult) => void
  // signal abort 리스너 정리용 (resolve 시 detach).
  detach: () => void
}

export class AskUserQuestionBroker {
  private readonly pending = new Map<string, Pending>()

  // 질문을 등록하고 사용자의 응답(또는 skip)을 기다리는 Promise 를 반환한다.
  // signal 이 abort 되면(턴 취소) skipped 로 resolve 하고 정리해 query() 가 멈출 수 있게 한다.
  register(requestId: string, signal?: AbortSignal): Promise<AskResult> {
    return new Promise<AskResult>((resolve) => {
      // 이미 abort 된 signal 이면 즉시 skip.
      if (signal?.aborted) {
        resolve({ type: 'skipped' })
        return
      }

      const onAbort = (): void => this.resolve(requestId, { type: 'skipped' })
      signal?.addEventListener('abort', onAbort)

      this.pending.set(requestId, {
        resolve,
        detach: () => signal?.removeEventListener('abort', onAbort)
      })
    })
  }

  // 사용자의 응답으로 보류 중인 Promise 를 해소한다. 미지의 requestId 거나 이미 해소된
  // 경우(중복 응답·abort 후 도착)는 무해하게 무시한다.
  resolve(requestId: string, result: AskResult): void {
    const entry = this.pending.get(requestId)
    if (!entry) return
    this.pending.delete(requestId)
    entry.detach()
    entry.resolve(result)
  }

  // 현재 보류 중인 요청 수 (테스트/진단용).
  get size(): number {
    return this.pending.size
  }
}
