import { describe, expect, it, vi } from 'vitest'
import type { DbQueries } from '../../infra/db/queries'
import type { LoadedPartRow } from '../../infra/db/types'
import type { ReceivedMessageOrigin } from '../../../shared/session-schedules'
import { withReceivedInputFormat } from '../../../shared/received-input'

vi.mock('electron', () => ({ webContents: { getAllWebContents: () => [] } }))

import { HistoryWriter } from './writer'
import { loadSession } from './reader'

describe('received input format history', () => {
  it.each(['claude', 'opencode'] as const)(
    'preserves source, format and the exact input through %s writer, DTO and reader',
    (backend) => {
      const messages: Parameters<DbQueries['appendMessage']>[0][] = []
      const parts: LoadedPartRow[] = []
      const db = {
        appendMessage: (message: Parameters<DbQueries['appendMessage']>[0]) => {
          messages.push(message)
          return messages.length
        },
        appendPart: (part: Parameters<DbQueries['appendPart']>[0]) => {
          const message = messages[part.messageId - 1]
          parts.push({
            message_id: part.messageId,
            role: message.role,
            created_at: message.createdAt,
            complete: 1,
            message_idx: part.messageId - 1,
            part_idx: 0,
            type: part.type,
            tool_run_id: part.toolRunId ?? null,
            payload_json: part.payloadJson
          })
          return parts.length
        },
        loadParts: () => parts,
        getSessionById: () => ({ id: 's', backend, agent_kind: 'code', cwd: '/fixture' }),
        getLineage: () => undefined,
        getManagedWorktreeBySession: () => undefined,
        usage: { getLatestTurnUsage: () => undefined, sumSessionCostUsd: () => 0 }
      } as unknown as DbQueries
      const writer = new HistoryWriter(db, () => false)
      const input: { text: string; origin?: ReceivedMessageOrigin }[] = [
        {
          text: '\n<system-reminder>  계속  </system-reminder>\n',
          origin: withReceivedInputFormat('<system-reminder>  계속  </system-reminder>', {
            kind: 'automatic'
          })
        },
        {
          text: '<task id="t">done</task>',
          origin: withReceivedInputFormat('<task id="t">done</task>', { kind: 'task', label: 't' })
        },
        { text: 'Continue.', origin: { kind: 'automatic', format: 'plain' } },
        { text: '<task>legacy</task>', origin: { kind: 'task' } },
        { text: '<system-reminder>user-authored example</system-reminder>' }
      ]
      const original = structuredClone(input)
      for (const [index, item] of input.entries()) {
        writer.persistUserMessage('s', item.text, 100 + index, undefined, undefined, item.origin)
      }
      const loaded = loadSession(db, 's', () => '/fallback')
      expect(loaded?.backend).toBe(backend)
      expect(loaded?.messages).toEqual(
        input.map((item, index) => ({
          role: 'user',
          createdAt: 100 + index,
          parts: [{ type: 'text', ...item }]
        }))
      )
      expect(messages.map((message) => message.content)).toEqual(input.map((item) => item.text))
      expect(input).toEqual(original)
    }
  )
})
