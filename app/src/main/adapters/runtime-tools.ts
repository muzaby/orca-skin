import type { z } from 'zod'

export interface RuntimeToolAnnotations {
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

export interface RuntimeToolDeclaration {
  name: string
  description: string
  annotations?: RuntimeToolAnnotations
}

export interface RuntimeToolDescriptor {
  id: string
  connectorId: string
  alwaysLoad?: boolean
  instructions?: string
  tools: readonly RuntimeToolDeclaration[]
}

// 도구 결과는 **MCP 표준 형상**이다. backend 중립과 무관한 선택이 아니라, 이 저장소가
// "엔진이 아니라 표준(MCP)을 1차 추상화" 로 정한 결정(`arch/backend/standardization.md`)의
// 연장이다. 이 타입이 없으면 handler 가 무엇을 돌려주든 SDK 경계에서 `content:[]` 로 조용히
// 비어버린다 — 0158 verify r1 D5.
export interface RuntimeToolTextContent {
  type: 'text'
  text: string
}

export type RuntimeToolContent = RuntimeToolTextContent

export interface RuntimeToolResult {
  content: RuntimeToolContent[]
  // true 면 모델이 '도구 실패' 로 읽는다. 취소·연결 소실·connector 오류는 반드시 여기에 실린다.
  isError?: boolean
  structuredContent?: Record<string, unknown>
  // MCP 결과는 passthrough 다(`_meta` 등). 강제하는 것은 `content` 존재이며, 그것이
  // 조용한 빈 성공을 막는 지점이다.
  [key: string]: unknown
}

export interface RuntimeToolImplementation {
  name: string
  inputSchema: z.ZodRawShape
  handler(input: Record<string, unknown>): Promise<RuntimeToolResult>
}

// 실행형 server는 정적 descriptor(정책 SSOT)와 connection별 factory 구현을 합친다.
// descriptor.id가 registry와 Claude SDK의 안정적인 server identity다.
export interface RuntimeToolServer {
  readonly descriptor: RuntimeToolDescriptor
  readonly implementations: readonly RuntimeToolImplementation[]
}

export interface RuntimeToolSnapshot {
  readonly revision: number
  readonly servers: ReadonlyMap<string, RuntimeToolServer>
}

// feature가 등록/제거하고 adapters가 다음 spawn에 읽는 최소 구조적 포트다.
export interface RuntimeToolSource {
  snapshot(): RuntimeToolSnapshot
}

export interface RuntimeToolSink {
  add(server: RuntimeToolServer): void
  remove(serverId: string): void
}

export interface PluginToolContext {
  readonly connectionId: string
  invoke(operation: string, params?: Record<string, unknown>): Promise<unknown>
  logger(message: string, meta?: Record<string, unknown>): void
  readonly signal: AbortSignal
}

export interface RuntimeToolContribution {
  readonly descriptor: RuntimeToolDescriptor
  create(ctx: PluginToolContext): readonly RuntimeToolImplementation[]
}
