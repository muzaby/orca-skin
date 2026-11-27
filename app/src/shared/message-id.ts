import type { NormalizedEvent } from './ipc'

export const PART_EVENT_TYPES = [
  'response.boundary',
  'message.completed',
  'message.reasoning',
  'tool.call.started',
  'tool.call.completed',
  'session.compacted',
  'subagent.task',
  'error'
] as const satisfies ReadonlyArray<NormalizedEvent['type']>

export type PartEventType = (typeof PART_EVENT_TYPES)[number]

export function assistantMessageId(id: string): string {
  return `a:${encodeURIComponent(id)}`
}

export function userMessageId(ids: readonly string[]): string {
  return `u:${ids.map(encodeURIComponent).join(',')}`
}

export function receivedMessageId(
  uuid: string | undefined,
  nativeId: string | undefined,
  newId: () => string
): string {
  if (uuid) return `i:${encodeURIComponent(uuid)}`
  if (nativeId) return `i:n:${encodeURIComponent(nativeId)}`
  return `i:g:${encodeURIComponent(newId())}`
}

export function localRowMessageId(id: number): string {
  return `m:${id}`
}

export function nativeOnlyMessageId(id: string): string {
  return `n:${encodeURIComponent(id)}`
}

export function orphanMessageId(id: string): string {
  return `${id}#o`
}

export function archivedMessageId(index: number): string {
  return `x:${index}`
}

export function rendererMessageId(id: string): string {
  return `r:${encodeURIComponent(id)}`
}

export function childMessageId(id: string): string {
  return `c:${encodeURIComponent(id)}`
}
