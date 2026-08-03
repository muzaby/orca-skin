import { createSdkMcpServer, type Options } from '@anthropic-ai/claude-agent-sdk'
import type { RuntimeToolServer, RuntimeToolSnapshot } from './runtime-tools'

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
      // Runtime contribution은 MCP CallToolResult를 반환할 책임을 가진다. 계약은 backend
      // 중립을 유지하므로 SDK 경계에서만 이 반환형을 좁힌다.
      handler: implementation.handler as never
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
