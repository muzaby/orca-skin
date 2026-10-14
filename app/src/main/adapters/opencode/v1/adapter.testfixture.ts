import type { AssistantMessage, Event, TextPart, ToolPart } from '@opencode-ai/sdk/v2'

let eventSequence = 0
export function openCodeEvent<T extends Event['type']>(
  type: T,
  properties: Extract<Event, { type: T }>['properties'],
  id = `event-${++eventSequence}`
): Extract<Event, { type: T }> {
  return { id, type, properties } as Extract<Event, { type: T }>
}

export function assistantMessage(
  sessionID = 's1',
  parentID = 'prompt-1',
  id = 'a1'
): AssistantMessage {
  return {
    id,
    sessionID,
    parentID,
    role: 'assistant',
    time: { created: 100, completed: 120 },
    modelID: 'model-1',
    providerID: 'provider-1',
    mode: 'build',
    agent: 'build',
    path: { cwd: 'C:/work', root: 'C:/work' },
    cost: 0.25,
    tokens: { input: 10, output: 20, reasoning: 3, cache: { read: 4, write: 5 } }
  }
}

export function textPart(text: string, overrides: Partial<TextPart> = {}): TextPart {
  return { id: 'p1', sessionID: 's1', messageID: 'a1', type: 'text', text, ...overrides }
}

export function editTool(overrides: Partial<ToolPart> = {}): ToolPart {
  return {
    id: 'tool-part',
    sessionID: 's1',
    messageID: 'a1',
    type: 'tool',
    callID: 'call-1',
    tool: 'edit',
    state: {
      status: 'completed',
      input: { filePath: 'src/a.ts', oldString: 'old', newString: 'new' },
      output: 'Updated file',
      title: 'Edit',
      metadata: { diff: '-old\n+new' },
      time: { start: 100, end: 125 }
    },
    ...overrides
  }
}

export function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}
