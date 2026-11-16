// 계산 클라이언트의 가짜 — 요청을 기록하고, 테스트가 원하는 때에 응답·실패시킨다.

import type { ComputeClient, ComputeHandle } from './client'
import { requestKey, type ComputeRequest, type ComputeResult } from './protocol'

export interface FakeCompute {
  client: ComputeClient
  requests: ComputeRequest[]
  cancelled: ComputeRequest[]
  // 아직 끝나지 않은 가장 오래된 요청을 끝낸다.
  resolveNext(result: ComputeResult): void
  rejectNext(): void
}

export function fakeComputeClient(): FakeCompute {
  const pending: Array<{
    request: ComputeRequest
    resolve: (result: ComputeResult) => void
    reject: (error: Error) => void
  }> = []
  const cache = new Map<string, ComputeResult>()
  const fake: FakeCompute = {
    requests: [],
    cancelled: [],
    resolveNext(result) {
      const next = pending.shift()
      if (!next) throw new Error('끝낼 요청이 없다')
      cache.set(requestKey(next.request), result)
      next.resolve(result)
    },
    rejectNext() {
      const next = pending.shift()
      if (!next) throw new Error('끝낼 요청이 없다')
      next.reject(new Error('compute worker failed'))
    },
    client: {
      peek: (request) => cache.get(requestKey(request)) as never,
      request(request): ComputeHandle<never> {
        fake.requests.push(request)
        let entry!: (typeof pending)[number]
        const promise = new Promise<ComputeResult>((resolve, reject) => {
          entry = { request, resolve, reject }
        })
        pending.push(entry)
        return {
          promise: promise as Promise<never>,
          cancel: () => {
            fake.cancelled.push(request)
            const at = pending.indexOf(entry)
            if (at >= 0) pending.splice(at, 1)
            entry.reject(new Error('cancelled'))
          }
        }
      }
    }
  }
  return fake
}
