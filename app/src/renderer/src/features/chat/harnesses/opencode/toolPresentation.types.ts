import type { ToolRunOutcome } from '../../lib/parts'

// SDK 필드는 버전별 decoder에서 해석하고 UI에는 이 중립 계약만 전달한다.
export interface OpenCodeFileView {
  path: string
  before?: string
  after?: string
  patch?: string
}

export interface OpenCodeToolView {
  kind:
    'read' | 'search' | 'list' | 'shell' | 'edit' | 'write' | 'web' | 'task' | 'todo' | 'generic'
  name: string
  subtitle: string
  arguments: string
  outcome: ToolRunOutcome
  output: string
  inputText: string
  command?: string
  url?: string
  files: OpenCodeFileView[]
  todos: { text: string; status: string }[]
  original?: { name: string; input: unknown }
}
