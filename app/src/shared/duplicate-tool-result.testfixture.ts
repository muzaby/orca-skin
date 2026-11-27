import type { NormalizedEvent } from './ipc'

export const duplicateToolResultEvents = (): NormalizedEvent[] => [
  {
    type: 'tool.call.started',
    sessionId: 's1',
    messageKey: 'a:first',
    toolRunId: 'dup',
    toolName: 'Agent',
    args: { description: 'First' }
  },
  {
    type: 'tool.call.started',
    sessionId: 's1',
    messageKey: 'a:second',
    toolRunId: 'dup',
    toolName: 'Agent',
    args: { description: 'Second' }
  },
  {
    type: 'tool.call.completed',
    sessionId: 's1',
    messageKey: 'a:first',
    toolRunId: 'dup',
    result: 'paired output',
    isError: false,
    messageKeySource: 'owner'
  }
]
