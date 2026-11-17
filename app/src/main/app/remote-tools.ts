// 런타임 도구·관리형 MCP 의 호스트 사이 사본 (0324 D-038 · F2 · AR-13 — 구현 보고 G-A·G-D).
//
// 플러그인·산출물 도구(`RuntimeToolServer`)와 관리형 MCP 스냅샷은 데이터 호스트가 소유한다(인증·DB 가
// 그쪽에 있다). 하네스는 에이전트 호스트에서 돈다 — Claude SDK 는 도구를 같은 프로세스의 MCP 서버로
// 붙이고, OpenCode 는 데이터 호스트의 로컬 HTTP 브리지에 붙는다. 함수는 경계를 넘지 못하므로:
//
// - 데이터 호스트는 바뀔 때마다 직렬화한 스냅샷(서술자 + 입력 JSON 스키마 + 인가 상태)을 보낸다.
// - 에이전트 호스트는 그 사본으로 같은 동기 API(`snapshot()`·`peek()`)를 유지하고, 도구 호출은 대리
//   구현이 데이터 호스트에 요청한다. 취소는 호출 id 로 따로 보낸다.
// - OpenCode 의 브리지 임대는 스냅샷 revision 으로 데이터 호스트에 요청한다.
//
// 이 파일은 Electron 을 모른다.

import { z } from 'zod'
import type {
  ManagedMcpBridgeLease,
  ManagedMcpIdentity,
  ManagedMcpPlugin,
  ManagedMcpRuntime,
  ManagedMcpSnapshot,
  ManagedMcpSource
} from '../adapters/common/managed-mcp'
import type { OoMcpConfig } from '../adapters/common/mcp-config'
import type {
  RuntimeToolApplicationContext,
  RuntimeToolContext,
  RuntimeToolDescriptor,
  RuntimeToolImplementation,
  RuntimeToolResult,
  RuntimeToolServer,
  RuntimeToolSnapshot,
  RuntimeToolSource
} from '../adapters/common/runtime-tools'

// ── 직렬화 형태 ────────────────────────────────────────────────────────────────────────────────

export interface RemoteToolSpec {
  name: string
  // `z.object(inputSchema)` 의 JSON 스키마.
  inputSchema: Record<string, unknown>
}

export interface RemoteToolServerSpec {
  descriptor: RuntimeToolDescriptor
  tools: RemoteToolSpec[]
}

export interface RemoteToolSnapshot {
  revision: number
  servers: RemoteToolServerSpec[]
}

export interface RemoteManagedMcpPlugin {
  id: string
  identity: ManagedMcpIdentity
  authorized: boolean
  credentialRevision: number
  server: RemoteToolServerSpec
}

export interface RemoteManagedMcpSnapshot {
  revision: number
  definitionRevision?: number
  connectionRevision?: number
  definitions?: OoMcpConfig
  desired?: Record<string, boolean>
  users: OoMcpConfig
  plugins: RemoteManagedMcpPlugin[]
  // 바뀐 종류 — 구독자에게 그대로 전한다.
  kind?: 'definitions' | 'connections'
}

export interface RemoteToolCall {
  callId: string
  // 런타임 도구 레지스트리의 서버(`'tools'`)인가, 관리형 MCP 의 플러그인 서버(`'mcp'`)인가.
  origin: 'tools' | 'mcp'
  serverId: string
  tool: string
  input: Record<string, unknown>
  context:
    | { scope: 'application' }
    | { scope: 'session'; cwd: string; extraDirs: string[]; sessionId: string }
}

export function serializeToolServer(server: RuntimeToolServer): RemoteToolServerSpec {
  return {
    descriptor: structuredClone(server.descriptor),
    tools: server.implementations.map((implementation) => ({
      name: implementation.name,
      inputSchema: z.toJSONSchema(z.object(implementation.inputSchema)) as Record<string, unknown>
    }))
  }
}

export function serializeRuntimeTools(snapshot: RuntimeToolSnapshot): RemoteToolSnapshot {
  return {
    revision: snapshot.revision,
    servers: [...snapshot.servers.values()].map(serializeToolServer)
  }
}

export function serializeManagedMcp(
  snapshot: Readonly<ManagedMcpSnapshot>,
  kind?: 'definitions' | 'connections'
): RemoteManagedMcpSnapshot {
  return {
    revision: snapshot.revision,
    ...(snapshot.definitionRevision !== undefined
      ? { definitionRevision: snapshot.definitionRevision }
      : {}),
    ...(snapshot.connectionRevision !== undefined
      ? { connectionRevision: snapshot.connectionRevision }
      : {}),
    ...(snapshot.definitions ? { definitions: structuredClone(snapshot.definitions) } : {}),
    ...(snapshot.desired ? { desired: { ...snapshot.desired } } : {}),
    users: structuredClone(snapshot.users),
    plugins: [...snapshot.plugins].map(([id, plugin]) => ({
      id,
      identity: { ...plugin.identity },
      authorized: plugin.authorized(),
      credentialRevision: plugin.credentialRevision(),
      server: serializeToolServer(plugin.server)
    })),
    ...(kind ? { kind } : {})
  }
}

// ── 데이터 호스트: 호출 처리 ────────────────────────────────────────────────────────────────────

export interface ToolCallHost {
  call(request: RemoteToolCall): Promise<RuntimeToolResult>
  cancel(callId: string): void
}

export function createToolCallHost(deps: {
  tools: RuntimeToolSource
  managedPlugins(): ReadonlyMap<string, ManagedMcpPlugin>
}): ToolCallHost {
  const running = new Map<string, AbortController>()
  const findServer = (request: RemoteToolCall): RuntimeToolServer | undefined => {
    if (request.origin === 'tools') return deps.tools.snapshot().servers.get(request.serverId)
    for (const plugin of deps.managedPlugins().values()) {
      if (plugin.server.descriptor.id === request.serverId) return plugin.server
    }
    return undefined
  }
  return {
    async call(request) {
      const implementation = findServer(request)?.implementations.find(
        (candidate) => candidate.name === request.tool
      )
      if (!implementation) {
        return {
          content: [
            { type: 'text', text: `도구를 찾지 못했습니다: ${request.serverId}/${request.tool}` }
          ],
          isError: true
        }
      }
      const controller = new AbortController()
      running.set(request.callId, controller)
      const context: RuntimeToolContext | RuntimeToolApplicationContext =
        request.context.scope === 'application'
          ? { scope: 'application', getSignal: () => controller.signal }
          : {
              cwd: request.context.cwd,
              extraDirs: request.context.extraDirs,
              getSignal: () => controller.signal,
              waitForSession: async () => (request.context as { sessionId: string }).sessionId
            }
      try {
        return await implementation.handler(request.input, context)
      } finally {
        running.delete(request.callId)
      }
    },
    cancel(callId) {
      running.get(callId)?.abort()
    }
  }
}

// ── 에이전트 호스트: 사본과 대리 ────────────────────────────────────────────────────────────────

export interface ToolCallPort {
  call(request: RemoteToolCall): Promise<RuntimeToolResult>
  cancel(callId: string): void
}

function isApplicationContext(
  context: RuntimeToolContext | RuntimeToolApplicationContext | undefined
): context is RuntimeToolApplicationContext {
  return (context as RuntimeToolApplicationContext | undefined)?.scope === 'application'
}

function proxyServer(
  spec: RemoteToolServerSpec,
  origin: RemoteToolCall['origin'],
  port: ToolCallPort,
  nextCallId: () => string
): RuntimeToolServer {
  const implementations: RuntimeToolImplementation[] = spec.tools.map((tool) => {
    const schema = z.fromJSONSchema(tool.inputSchema)
    const shape = schema instanceof z.ZodObject ? (schema.shape as z.ZodRawShape) : {}
    return {
      name: tool.name,
      inputSchema: shape,
      async handler(input, context) {
        const callId = nextCallId()
        const signal = context?.getSignal()
        if (signal?.aborted) {
          return { content: [{ type: 'text', text: '도구 호출이 취소됐습니다.' }], isError: true }
        }
        // 세션 범위 도구는 세션 id 를 실어 보낸다 — 데이터 호스트는 세션을 기다릴 수 없다.
        const scoped: RemoteToolCall['context'] =
          !context || isApplicationContext(context)
            ? { scope: 'application' }
            : {
                scope: 'session',
                cwd: context.cwd,
                extraDirs: [...context.extraDirs],
                sessionId: await context.waitForSession(signal ?? new AbortController().signal)
              }
        const onAbort = (): void => port.cancel(callId)
        signal?.addEventListener('abort', onAbort, { once: true })
        try {
          return await port.call({
            callId,
            origin,
            serverId: spec.descriptor.id,
            tool: tool.name,
            input,
            context: scoped
          })
        } finally {
          signal?.removeEventListener('abort', onAbort)
        }
      }
    }
  })
  return { descriptor: spec.descriptor, implementations }
}

export interface RemoteRuntimeTools extends RuntimeToolSource {
  apply(snapshot: RemoteToolSnapshot): void
}

export function createRemoteRuntimeTools(port: ToolCallPort): RemoteRuntimeTools {
  let seq = 0
  const nextCallId = (): string => `tool_${++seq}`
  let current: RuntimeToolSnapshot = { revision: 0, servers: new Map() }
  return {
    snapshot: () => current,
    apply(snapshot) {
      current = {
        revision: snapshot.revision,
        servers: new Map(
          snapshot.servers.map((spec) => [
            spec.descriptor.id,
            proxyServer(spec, 'tools', port, nextCallId)
          ])
        )
      }
    }
  }
}

export interface ManagedMcpLeasePort {
  acquire(
    revision: number
  ): Promise<{ leaseId: string; endpoints: Array<[string, { url: string; token: string }]> }>
  release(leaseId: string): Promise<void>
}

export interface RemoteManagedMcp extends ManagedMcpSource {
  acquire: ManagedMcpRuntime['acquire']
  apply(snapshot: RemoteManagedMcpSnapshot): void
}

// 데이터 호스트의 관리형 MCP 사본. 사본을 받기 전에는 스냅샷이 없다(`undefined` — 관리형 MCP 없이 띄운다).
export function createRemoteManagedMcp(
  tools: ToolCallPort,
  leases: ManagedMcpLeasePort
): RemoteManagedMcp {
  let seq = 0
  const nextCallId = (): string => `mcp_${++seq}`
  let current: ManagedMcpSnapshot | undefined
  const listeners = new Set<(revision: number, kind?: 'definitions' | 'connections') => void>()
  const empty = (): ManagedMcpSnapshot => ({ revision: 0, users: {}, plugins: new Map() })
  return {
    peek: () => current ?? empty(),
    snapshot: () => {
      const value = current ?? empty()
      return { ...value, plugins: new Map(value.plugins) }
    },
    // 다시 계산은 데이터 호스트가 한다 — 사본은 다음 통지에서 바뀐다.
    refresh: () => {},
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    async acquire(snapshot): Promise<ManagedMcpBridgeLease> {
      const { leaseId, endpoints } = await leases.acquire(snapshot.revision)
      let released = false
      return {
        endpoints: new Map(endpoints),
        release: async () => {
          if (released) return
          released = true
          await leases.release(leaseId)
        }
      }
    },
    apply(snapshot) {
      current = {
        revision: snapshot.revision,
        ...(snapshot.definitionRevision !== undefined
          ? { definitionRevision: snapshot.definitionRevision }
          : {}),
        ...(snapshot.connectionRevision !== undefined
          ? { connectionRevision: snapshot.connectionRevision }
          : {}),
        ...(snapshot.definitions ? { definitions: snapshot.definitions } : {}),
        ...(snapshot.desired ? { desired: snapshot.desired } : {}),
        users: snapshot.users,
        plugins: new Map(
          snapshot.plugins.map((plugin): [string, ManagedMcpPlugin] => [
            plugin.id,
            {
              identity: plugin.identity,
              server: proxyServer(plugin.server, 'mcp', tools, nextCallId),
              authorized: () => plugin.authorized,
              credentialRevision: () => plugin.credentialRevision
            }
          ])
        )
      }
      for (const listener of [...listeners]) listener(snapshot.revision, snapshot.kind)
    }
  }
}

// 관리형 MCP 의 브리지 임대 — revision 으로 찾는다. 최근 스냅샷 몇 개만 둔다(바로 앞 revision 으로 온
// 요청이 사이에 바뀐 스냅샷 때문에 실패하지 않게).
export function createManagedMcpLeaseHost(deps: {
  current(): ManagedMcpSnapshot
  acquire(snapshot: ManagedMcpSnapshot): Promise<ManagedMcpBridgeLease>
  keep?: number
}): {
  remember(snapshot: ManagedMcpSnapshot): void
  acquire(
    revision: number
  ): Promise<{ leaseId: string; endpoints: Array<[string, { url: string; token: string }]> }>
  release(leaseId: string): Promise<void>
  releaseAll(): Promise<void>
} {
  const keep = deps.keep ?? 8
  const recent = new Map<number, ManagedMcpSnapshot>()
  const leases = new Map<string, ManagedMcpBridgeLease>()
  let seq = 0
  return {
    remember(snapshot) {
      recent.set(snapshot.revision, snapshot)
      while (recent.size > keep) recent.delete(recent.keys().next().value!)
    },
    async acquire(revision) {
      const current = deps.current()
      const snapshot = current.revision === revision ? current : recent.get(revision)
      if (!snapshot) throw new Error(`관리형 MCP 스냅샷이 없습니다: ${revision}`)
      const lease = await deps.acquire(snapshot)
      const leaseId = `lease_${++seq}`
      leases.set(leaseId, lease)
      return { leaseId, endpoints: [...lease.endpoints] }
    },
    async release(leaseId) {
      const lease = leases.get(leaseId)
      leases.delete(leaseId)
      await lease?.release()
    },
    async releaseAll() {
      const all = [...leases.values()]
      leases.clear()
      await Promise.allSettled(all.map((lease) => lease.release()))
    }
  }
}

// MCP 설정·앱 환경의 `${…}` 참조 이름. 데이터 호스트가 해석값을 모아 실행 쪽 해석기 사본을 만든다.
export function referencedVariables(...values: unknown[]): string[] {
  const names = new Set<string>()
  const text = JSON.stringify(values)
  for (const match of text.matchAll(/\$\{([^}]+)\}/g)) names.add(match[1]!)
  return [...names]
}
