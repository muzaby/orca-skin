/**
 * Shared E2E fixture for 0326 VP-02 / ST-01 / AC1.
 * Both main (`message-identity.integration.test.ts`) and renderer (`chatReducer.messageIdentity.test.ts`)
 * consume the exact same deterministic event sequence and expected message literals.
 */
import type { AppMessagePart, NormalizedEvent } from './ipc'
import { assistantMessageId, userMessageId } from './message-id'

export interface ExpectedPartSummary {
  readonly type: AppMessagePart['type']
  readonly toolRunId?: string
  readonly summary: string
}

export interface ExpectedIdentityMessage {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly parts: readonly ExpectedPartSummary[]
}

export const ST01_ARTIFACT_RECEIPT = JSON.stringify({
  type: 'orcinus-orca.artifact.published',
  version: 1,
  publicationId: 'st01-publication'
})
export const ST01_SESSION_ID = 'st01-session'
export const ST01_USER_INITIAL_ID = userMessageId(['req-1'])
export const ST01_USER_STEER_ID = userMessageId(['steer-1'])
export const ST01_ASSISTANT_A_ID = assistantMessageId('1')
export const ST01_ASSISTANT_B_ID = assistantMessageId('2')
export const ST01_ASSISTANT_C_ID = assistantMessageId('3')

function extractResultText(result: unknown): string {
  if (typeof result === 'string') return result
  if (result && typeof result === 'object' && 'text' in result) {
    return String((result as { text: unknown }).text)
  }
  if (result && typeof result === 'object' && 'answers' in result) {
    return JSON.stringify((result as { answers: unknown }).answers)
  }
  return result === undefined ? '' : JSON.stringify(result)
}

export function summarizePart(part: AppMessagePart): ExpectedPartSummary {
  switch (part.type) {
    case 'text':
      return { type: 'text', summary: part.text }
    case 'reasoning':
      return { type: 'reasoning', summary: part.text }
    case 'tool_call':
      return { type: 'tool_call', toolRunId: part.toolRunId, summary: part.toolName }
    case 'tool_result':
      return {
        type: 'tool_result',
        toolRunId: part.toolRunId,
        summary: extractResultText(part.result)
      }
    case 'subagent_notice':
      return { type: 'subagent_notice', summary: `${part.status}:${part.toolRunId}` }
    case 'error': {
      const err = part.error as { message?: string } | string | undefined
      const msg = typeof err === 'string' ? err : (err?.message ?? '')
      return { type: 'error', summary: msg }
    }
    default:
      return { type: part.type, summary: '' }
  }
}

export function summarizeMessage(msg: {
  id: string
  role: 'user' | 'assistant'
  parts: readonly AppMessagePart[]
}): ExpectedIdentityMessage {
  const text = msg.parts
    .filter((p): p is Extract<AppMessagePart, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('\n')
  return {
    id: msg.id,
    role: msg.role,
    text,
    parts: msg.parts.map(summarizePart)
  }
}

export const ST01_EXPECTED_LIVE_MESSAGES: readonly ExpectedIdentityMessage[] = [
  {
    id: ST01_USER_INITIAL_ID,
    role: 'user',
    text: 'initial prompt',
    parts: [{ type: 'text', summary: 'initial prompt' }]
  },
  {
    id: ST01_ASSISTANT_A_ID,
    role: 'assistant',
    text: 'assistant A text',
    parts: [
      { type: 'reasoning', summary: 'thinking A' },
      { type: 'text', summary: 'assistant A text' },
      { type: 'tool_call', toolRunId: 'tool-x', summary: 'Bash' },
      { type: 'tool_call', toolRunId: 'tool-y', summary: 'Write' },
      { type: 'tool_result', toolRunId: 'tool-y', summary: ST01_ARTIFACT_RECEIPT },
      { type: 'tool_call', toolRunId: 'tool-q', summary: 'AskUserQuestion' },
      { type: 'tool_result', toolRunId: 'tool-q', summary: '{"q1":"yes"}' },
      { type: 'tool_result', toolRunId: 'tool-x', summary: 'late X result' }
    ]
  },
  {
    id: ST01_USER_STEER_ID,
    role: 'user',
    text: 'mid steer prompt',
    parts: [{ type: 'text', summary: 'mid steer prompt' }]
  },
  {
    id: ST01_ASSISTANT_B_ID,
    role: 'assistant',
    text: 'assistant B text',
    parts: [{ type: 'text', summary: 'assistant B text' }]
  },
  {
    id: ST01_ASSISTANT_C_ID,
    role: 'assistant',
    text: 'continuation C text',
    parts: [
      { type: 'text', summary: 'continuation C text' },
      { type: 'subagent_notice', summary: 'completed:sub-1' }
    ]
  }
]

export const ST01_EXPECTED_RELOAD_MESSAGES: readonly ExpectedIdentityMessage[] = [
  ...ST01_EXPECTED_LIVE_MESSAGES.slice(0, -1),
  {
    ...ST01_EXPECTED_LIVE_MESSAGES[ST01_EXPECTED_LIVE_MESSAGES.length - 1],
    parts: [
      ...ST01_EXPECTED_LIVE_MESSAGES[ST01_EXPECTED_LIVE_MESSAGES.length - 1].parts,
      { type: 'error', summary: 'turn error after recommit' }
    ]
  }
]

/**
 * Exact window-arrival event sequence (D-098):
 * steer `message.committed` arrives AFTER queued A events (Y result, Q start, Q answer) and BEFORE B text.
 */
export const ST01_WINDOW_EVENTS: readonly NormalizedEvent[] = [
  {
    type: 'message.committed',
    sessionId: ST01_SESSION_ID,
    ids: ['req-1'],
    text: 'initial prompt',
    messageId: 1,
    createdAt: 1,
    messageKey: ST01_USER_INITIAL_ID
  },
  {
    type: 'message.reasoning',
    sessionId: ST01_SESSION_ID,
    text: 'thinking A',
    messageKey: ST01_ASSISTANT_A_ID
  },
  {
    type: 'message.completed',
    sessionId: ST01_SESSION_ID,
    message: { text: 'assistant A text' },
    messageKey: ST01_ASSISTANT_A_ID
  },
  {
    type: 'tool.call.started',
    sessionId: ST01_SESSION_ID,
    toolRunId: 'tool-x',
    toolName: 'Bash',
    args: { command: 'echo x' },
    messageKey: ST01_ASSISTANT_A_ID
  },
  {
    type: 'tool.call.started',
    sessionId: ST01_SESSION_ID,
    toolRunId: 'tool-y',
    toolName: 'Write',
    args: { file_path: 'out.txt' },
    messageKey: ST01_ASSISTANT_A_ID
  },
  {
    type: 'tool.call.completed',
    sessionId: ST01_SESSION_ID,
    toolRunId: 'tool-y',
    result: ST01_ARTIFACT_RECEIPT,
    isError: false,
    messageKey: ST01_ASSISTANT_A_ID,
    messageKeySource: 'owner'
  },
  {
    type: 'tool.call.started',
    sessionId: ST01_SESSION_ID,
    toolRunId: 'tool-q',
    toolName: 'AskUserQuestion',
    args: { questions: [] },
    messageKey: ST01_ASSISTANT_A_ID
  },
  {
    type: 'tool.call.completed',
    sessionId: ST01_SESSION_ID,
    toolRunId: 'tool-q',
    result: { answers: { q1: 'yes' } },
    isError: false,
    messageKey: ST01_ASSISTANT_A_ID,
    messageKeySource: 'owner'
  },
  {
    type: 'message.committed',
    sessionId: ST01_SESSION_ID,
    ids: ['steer-1'],
    text: 'mid steer prompt',
    messageId: 3,
    createdAt: 2,
    messageKey: ST01_USER_STEER_ID
  },
  {
    type: 'message.completed',
    sessionId: ST01_SESSION_ID,
    message: { text: 'assistant B text' },
    messageKey: ST01_ASSISTANT_B_ID
  },
  {
    type: 'tool.call.completed',
    sessionId: ST01_SESSION_ID,
    toolRunId: 'tool-x',
    result: 'late X result',
    isError: false,
    messageKey: ST01_ASSISTANT_A_ID,
    messageKeySource: 'owner'
  },
  {
    type: 'telemetry',
    sessionId: ST01_SESSION_ID,
    usage: { inputTokens: 10, outputTokens: 5 }
  } as NormalizedEvent,
  {
    type: 'message.completed',
    sessionId: ST01_SESSION_ID,
    message: { text: 'continuation C text' },
    messageKey: ST01_ASSISTANT_C_ID
  },
  {
    type: 'subagent.task',
    sessionId: ST01_SESSION_ID,
    toolUseId: 'sub-1',
    phase: 'settled',
    background: true,
    status: 'completed',
    summary: 'done',
    messageKey: ST01_ASSISTANT_C_ID
  } as NormalizedEvent,
  // Recommit of same steer batch — no-op (D-097)
  {
    type: 'message.committed',
    sessionId: ST01_SESSION_ID,
    ids: ['steer-1'],
    text: 'mid steer prompt',
    messageId: 3,
    createdAt: 2,
    messageKey: ST01_USER_STEER_ID
  },
  // Error — banner in renderer, part at end of C in reload (B7)
  {
    type: 'error',
    sessionId: ST01_SESSION_ID,
    error: {
      category: 'stream_error',
      message: 'turn error after recommit',
      retryable: false
    },
    messageKey: ST01_ASSISTANT_C_ID
  }
]
