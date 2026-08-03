import { createSdkMcpServer, type Options } from '@anthropic-ai/claude-agent-sdk'
import type {
  RuntimeToolImplementation,
  RuntimeToolResult,
  RuntimeToolServer,
  RuntimeToolSnapshot
} from './runtime-tools'

// SDK 는 handler 반환값의 **형상을 검증하지 않는다** — `content` 가 없으면 그대로
// `{content:[]}` 이 되어 모델에는 "성공했고 결과가 비었다" 로 보인다(0158 verify r1 D5 실측).
// 그래서 경계에서 직접 검사하고, 어긋나면 throw 한다. SDK 는 handler 예외를
// `{content:[{type:'text',…}], isError:true}` 로 변환하므로(`server/mcp.js:135-161`)
// 잘못된 플러그인 반환은 **조용한 빈 성공이 아니라 도구 실패**로 드러난다.
function assertRuntimeToolResult(
  value: unknown,
  serverId: string,
  toolName: string
): RuntimeToolResult {
  const result = value as RuntimeToolResult | undefined
  const contentOk =
    result !== null &&
    typeof result === 'object' &&
    Array.isArray(result?.content) &&
    result.content.every(
      (part) => part !== null && typeof part === 'object' && part.type === 'text'
    )
  if (!contentOk) {
    throw new Error(
      `Runtime tool returned a non-MCP result: ${serverId}/${toolName}. ` +
        `Expected { content: [{ type: 'text', text }], isError? }.`
    )
  }
  return result
}

function adaptHandler(
  implementation: RuntimeToolImplementation,
  serverId: string
): (args: Record<string, unknown>) => Promise<RuntimeToolResult> {
  return async (args) =>
    assertRuntimeToolResult(await implementation.handler(args), serverId, implementation.name)
}

function adaptServer(
  server: RuntimeToolServer,
  serverId: string
): ReturnType<typeof createSdkMcpServer> {
  const implementations = new Map(
    server.implementations.map((implementation) => [implementation.name, implementation])
  )
  const tools = server.descriptor.tools.map((declaration) => {
    const implementation = implementations.get(declaration.name)
    if (!implementation) {
      throw new Error(`Runtime tool implementation is missing: ${serverId}/${declaration.name}`)
    }
    return {
      name: implementation.name,
      description: declaration.description,
      annotations: declaration.annotations,
      inputSchema: implementation.inputSchema,
      handler: adaptHandler(implementation, serverId)
    }
  })

  return createSdkMcpServer({
    name: serverId,
    ...(server.descriptor.instructions ? { instructions: server.descriptor.instructions } : {}),
    ...(server.descriptor.alwaysLoad ? { alwaysLoad: true } : {}),
    tools
  })
}

// SDK 동적 MCP map은 runtime snapshot이 실제로 있을 때만 주입한다. 빈 map을 넘기면 기존
// plugin/.mcp.json 경로의 현행 동작까지 strict runtime surface로 바뀔 수 있으므로 key 자체를 생략한다.
export function adaptRuntimeTools(
  snapshot?: RuntimeToolSnapshot
): Pick<Options, 'mcpServers'> | Record<never, never> {
  if (!snapshot || snapshot.servers.size === 0) return {}

  const mcpServers: NonNullable<Options['mcpServers']> = {}
  for (const [serverId, server] of snapshot.servers) {
    mcpServers[serverId] = adaptServer(server, serverId)
  }
  return { mcpServers }
}
