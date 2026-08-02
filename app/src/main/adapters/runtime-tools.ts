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
  pluginId: string
  connectorId: string
  apiVersion: 1
  alwaysLoad?: boolean
  instructions?: string
  tools: readonly RuntimeToolDeclaration[]
}

export interface RuntimeToolImplementation {
  name: string
  inputSchema: z.ZodRawShape
  handler(input: Record<string, unknown>): Promise<unknown>
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
