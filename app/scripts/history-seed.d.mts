export interface SeedTarget {
  kind: 'first-body' | 'search-target'
  sessionId: string
  messageId: string
  expectText: string
}
export interface SeedMessage {
  id: string
  role: 'user' | 'assistant'
  createdAt: number
  parts: { type: 'text'; text: string }[]
}
export interface SeedSession {
  id: string
  harness: string
  backend: string
  agentKind: string
  title: string
  cwd: string
  messages: SeedMessage[]
  updatedAt: number
}
export interface SeedSpec {
  sessions: SeedSession[]
  targets: Record<string, SeedTarget>
}
export const HARNESSES: Record<string, { backend: string; agentKind: string }>
export const SEARCH_TEXT: string
export const LATEST_TEXT: string
export function displayId(nativeId: string): string
export function migrationList(names: string[], until?: string): string[]
export function seedSpec(options?: { turns?: number[]; large?: boolean; cwd?: string }): SeedSpec
export function writeSeed(
  db: unknown,
  spec: SeedSpec,
  options: { migrationsDir: string; until?: string; now?: () => number }
): string[]
