// 테스트용 데이터 포트 — 실행 쪽 코드가 받는 `ctx.data` 를 실제 연산 표(`data-ops.ts`) 위에 세운다.
// 프로세스 경계와 같게 인자·결과를 구조화 복제하고 다음 마이크로태스크에 답한다. `db` 는 진짜
// `DbQueries` 나 필요한 메서드만 가진 가짜다(없는 메서드는 그 연산을 부를 때 던진다).

import type { DbQueries } from '../../infra/db'
import type { OpTable, RemoteOps } from '../../infra/ipc/peer-ops'
import type { DataPort } from '../context'
import {
  createDataQueryOps,
  createDataWriteOps,
  type DataQueryOps,
  type DataWriteOps
} from './data-ops'

export const FIXTURE_DEFAULT_CWD = '/fixture/default-cwd'

function remote<T extends OpTable>(table: T): RemoteOps<T> {
  return new Proxy({} as RemoteOps<T>, {
    get: (_target, op) => {
      if (typeof op !== 'string' || op === 'then') return undefined
      return async (...args: unknown[]) => {
        if (!Object.hasOwn(table, op)) throw new Error(`표에 없는 피어 연산: ${op}`)
        const result: unknown = await table[op](...structuredClone(args))
        return structuredClone(result)
      }
    }
  })
}

export function directDataPort(
  db: unknown,
  options: {
    // 프로젝트 작업 폴더 해석을 테스트가 정한다(없으면 `db.getProject` 에서 푼다).
    getCwd?: (projectId?: string | null) => string
    defaultCwd?: string
  } = {}
): DataPort {
  const deps = {
    db: db as DbQueries,
    defaultCwd: () => options.defaultCwd ?? FIXTURE_DEFAULT_CWD
  }
  const query: DataQueryOps = createDataQueryOps(deps)
  const { getCwd } = options
  if (getCwd) {
    query.workspacePaths = (ids) => ids.map((id) => [id, getCwd(id)])
  }
  const write: DataWriteOps = createDataWriteOps(deps)
  return { query: remote(query), write: remote(write) }
}

// 테스트 컨텍스트(`{ db, getCwd?, … }`)에 `data`·`defaultCwd` 를 붙여 같은 객체를 돌려준다. `db`·`getCwd`
// 는 부를 때 읽으므로, 테스트가 나중에 바꿔 끼운 가짜도 그대로 보인다.
export function withDataPort<T extends object>(
  ctx: T
): T & { data: DataPort; defaultCwd(): string } {
  const source = ctx as {
    db?: Record<string, unknown>
    getCwd?: (projectId?: string | null) => string
  }
  const db = new Proxy(
    {},
    { get: (_target, key) => (source.db as Record<string | symbol, unknown> | undefined)?.[key] }
  )
  const cwd = (projectId?: string | null): string =>
    source.getCwd ? source.getCwd(projectId) : FIXTURE_DEFAULT_CWD
  return Object.assign(ctx, {
    data: directDataPort(db, { getCwd: cwd }),
    defaultCwd: () => cwd(null)
  })
}
