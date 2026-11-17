// 테스트용 데이터 포트 — 실행 쪽 코드가 받는 `ctx.data` 를 실제 연산 표(`data-ops.ts`) 위에 세운다.
// 프로세스 경계와 같게 인자·결과를 구조화 복제하고 다음 마이크로태스크에 답한다. `db` 는 진짜
// `DbQueries` 나 필요한 메서드만 가진 가짜다(없는 메서드는 그 연산을 부를 때 던진다).

import type { DbQueries } from '../../infra/db'
import type { OpTable, RemoteOps } from '../../infra/ipc/peer-ops'
import { harnessConfigPort, type DataPort, type HarnessConfigPort } from '../context'
import {
  createDataQueryOps,
  createDataWriteOps,
  type DataOpsDeps,
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

// 하네스 실행 구성 서비스(설정 트리·실행 구성·카탈로그)와 MCP 해석기 — 테스트의 가짜나 실제 객체다.
export interface FixtureHarnessServices {
  harnessSettings?: unknown
  harnessRuntime?: unknown
  runtimeModelCatalog?: unknown
  mcp?: unknown
}

function harnessDeps(services: FixtureHarnessServices): Pick<DataOpsDeps, 'harness' | 'mcp'> {
  return {
    ...(services.harnessSettings || services.harnessRuntime || services.runtimeModelCatalog
      ? {
          harness: {
            settings: (services.harnessSettings ?? {}) as never,
            runtime: (services.harnessRuntime ?? {}) as never,
            catalog: (services.runtimeModelCatalog ?? {}) as never
          }
        }
      : {}),
    ...(services.mcp ? { mcp: services.mcp as never } : {})
  }
}

export function directDataPort(
  db: unknown,
  options: {
    // 프로젝트 작업 폴더 해석을 테스트가 정한다(없으면 `db.getProject` 에서 푼다).
    getCwd?: (projectId?: string | null) => string
    defaultCwd?: string
    services?: FixtureHarnessServices
  } = {}
): DataPort {
  const deps: DataOpsDeps = {
    db: db as DbQueries,
    defaultCwd: () => options.defaultCwd ?? FIXTURE_DEFAULT_CWD,
    ...harnessDeps(options.services ?? {})
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
): T & { data: DataPort; defaultCwd(): string; harness: HarnessConfigPort } {
  const source = ctx as {
    db?: Record<string, unknown>
    getCwd?: (projectId?: string | null) => string
  } & FixtureHarnessServices
  const db = new Proxy(
    {},
    { get: (_target, key) => (source.db as Record<string | symbol, unknown> | undefined)?.[key] }
  )
  const cwd = (projectId?: string | null): string =>
    source.getCwd ? source.getCwd(projectId) : FIXTURE_DEFAULT_CWD
  // 하네스 서비스는 부를 때 읽는다 — 테스트가 나중에 바꿔 끼운 가짜도 보인다.
  const late = (
    key: keyof FixtureHarnessServices,
    fallback: Record<string, unknown> = {}
  ): unknown =>
    new Proxy(
      {},
      {
        get: (_target, name) => {
          const owner = (source[key] ?? fallback) as Record<string | symbol, unknown>
          const value = owner[name]
          // 메서드는 원래 객체에 묶는다 — 클래스 인스턴스의 `this` 가 프록시가 되지 않게.
          return typeof value === 'function' ? value.bind(owner) : value
        }
      }
    )
  const data = directDataPort(db, {
    getCwd: cwd,
    services: {
      harnessSettings: late('harnessSettings'),
      harnessRuntime: late('harnessRuntime'),
      runtimeModelCatalog: late('runtimeModelCatalog'),
      // MCP 저장소를 주지 않은 테스트는 치환할 값이 없는 해석기를 쓴다.
      mcp: late('mcp', { resolver: () => () => undefined })
    }
  })
  return Object.assign(ctx, {
    data,
    defaultCwd: () => cwd(null),
    harness: harnessConfigPort(data)
  })
}

// 엔진 핸들러 컨텍스트 — 옛 세 서비스를 데이터 호스트 연산 위의 `harness` 포트로 묶는다.
export function harnessPortOf(services: FixtureHarnessServices): HarnessConfigPort {
  return harnessConfigPort(directDataPort({}, { services }))
}

export function engineContext<T extends { deployExtensions: unknown } & FixtureHarnessServices>(
  ctx: T
): { deployExtensions: T['deployExtensions']; harness: HarnessConfigPort } {
  return { deployExtensions: ctx.deployExtensions, harness: harnessPortOf(ctx) }
}
