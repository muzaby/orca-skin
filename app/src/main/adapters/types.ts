import type { Backend, ChatEvent } from '../../shared/ipc'

export type { Backend, ChatEvent }

// claude-agent-sdk 의 query().options.mcpServers value 와 구조적으로 호환되는 로컬 타입.
// SDK export 이름 변경에 영향받지 않도록 spec (typescript.md §McpServerConfig) 을 그대로 옮긴다.
export type McpServerConfig =
  | { type?: 'stdio'; command: string; args?: string[]; env?: Record<string, string> }
  | { type: 'http'; url: string; headers?: Record<string, string> }

// 한 query 에 주입할 MCP 옵션 묶음. servers 가 비어 있으면 호출부에서 옵션 자체를 생략한다.
export interface McpQueryOptions {
  servers: Record<string, McpServerConfig>
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
