export const MODEL_OUTPUT_EVENT_TYPES = [
  'message.delta',
  'message.reasoning.delta',
  'message.reasoning',
  'message.completed',
  'tool.call.started'
] as const

const MODEL_OUTPUT_EVENT_SET: ReadonlySet<string> = new Set(MODEL_OUTPUT_EVENT_TYPES)

export function isModelOutputEvent(ev: { type: string }): boolean {
  return MODEL_OUTPUT_EVENT_SET.has(ev.type)
}
