import type { Backend, ChatEvent } from '../../shared/ipc'
import type { ClaudeMcpConfig } from '../mcp/schema'

export type { Backend, ChatEvent }

// 한 query 에 주입할 MCP 옵션 묶음. 어댑터 레이어로 넘어온 시점이므로 servers 는 정규형이 아니라
// **백엔드 타깃 타입(ClaudeMcpConfig)** 으로 다룬다 — claude-code 의 query().options.mcpServers
// (Record<string, McpServerConfig>) 에 그대로 대입된다. servers 가 비어 있으면 옵션 자체를 생략.
export interface McpQueryOptions {
  servers: ClaudeMcpConfig
  allowedTools: string[]
}

export interface SessionAdapter {
  readonly id: Backend
  isInstalled(): Promise<{ installed: boolean; version?: string; binPath?: string }>
  install(): AsyncIterable<{ step: string; log?: string; error?: string; done?: boolean }>
  sendMessage(
    sessionId: string | null,
    text: string,
    cwd: string,
    signal?: AbortSignal,
    // SDK 기본 시스템 프롬프트(claude_code preset) 뒤에 append 할 프로젝트별 지침.
    // 비어 있거나 undefined 면 SDK 기본 동작 그대로.
    systemPromptAppend?: string,
    // 활성화된 MCP 서버 + 허용 도구. undefined 또는 빈 servers 면 옵션 미주입.
    mcp?: McpQueryOptions,
    // agent 도구(Bash 등)가 실행될 자식 프로세스에 주입할 환경변수. Python 런타임
    // (uv 격리 인터프리터) 의 UV_*/PATH 등이 들어온다. undefined 면 SDK 기본 env.
    env?: Record<string, string>
  ): AsyncIterable<ChatEvent>
}
