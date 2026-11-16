// 피어 요청의 `op` 표 (0324 AR-13 · F2 · F4). `data.query`·`data.write`·`agent.call` 은 메서드 하나에
// 이름 붙은 연산 여럿을 싣는다 — 받는 쪽은 표에 있는 이름만 실행하고, 보내는 쪽은 같은 표의 타입으로
// 부른다. 표가 곧 두 호스트 사이에 열린 연산의 전부다.

import { PeerOpSchema } from '../../../shared/peer-protocol'

// 표의 값은 인자·결과가 구조화 복제 가능한 함수여야 한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 표마다 인자 모양이 다르다
export type OpTable = Record<string, (...args: any[]) => unknown>

export type RemoteOps<T extends OpTable> = {
  [K in keyof T]: (...args: Parameters<T[K]>) => Promise<Awaited<ReturnType<T[K]>>>
}

export function unknownOpError(op: string): string {
  return `표에 없는 피어 연산: ${op}`
}

// 받는 쪽 — 봉투를 검증하고 표에 있는 이름만 실행한다. 상속된 이름(`constructor` 등)은 표가 아니다.
export function createOpDispatcher(table: OpTable): (payload: unknown) => unknown {
  return (payload) => {
    const { op, args } = PeerOpSchema.parse(payload)
    if (!Object.hasOwn(table, op)) throw new Error(unknownOpError(op))
    return table[op](...args)
  }
}

// 보내는 쪽 — `ops.name(a, b)` 를 `{op:'name', args:[a, b]}` 요청으로 바꾼다.
export function createRemoteOps<T extends OpTable>(
  send: (payload: { op: string; args: unknown[] }) => Promise<unknown>
): RemoteOps<T> {
  return new Proxy({} as RemoteOps<T>, {
    get: (_target, op) => {
      // `await ops` 가 thenable 로 오인하지 않게 한다.
      if (typeof op !== 'string' || op === 'then') return undefined
      return (...args: unknown[]) => send({ op, args })
    }
  })
}
