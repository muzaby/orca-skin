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
