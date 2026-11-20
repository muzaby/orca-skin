import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { initialChatState, chatReducer, type Message } from '../../reducer/chatReducer'
import { transcriptIndexFor } from '../../lib/transcriptIndex'

const CHAT_ROOT = resolve(__dirname, '../..')

const CONSUMER_FILES = [
  'harnesses/opencode/rightpanel/tiles.tsx',
  'harnesses/opencode/rightpanel/AgentViews.tsx',
  'harnesses/claude/rightpanel/LegacySubAgentTile.tsx',
  'harnesses/claude/rightpanel/CanonicalBackgroundContent.tsx',
  'harnesses/common/transcript/InlineSubagentDetail.tsx',
  'harnesses/common/transcript/SubagentNoticeRow.tsx',
  'harnesses/common/transcript/AgentTaskRow.tsx',
  'hooks/useTaskContext.ts',
  'hooks/useTaskBoard.ts'
] as const

const scanNames = [
  'childMessageForParentToolRunId',
  'subagentTaskDescription',
  'subagentTasksFromMessages',
  'taskBoardFromMessages',
  'taskBoardForMessages',
  'transcriptResultsByToolUseId',
  'persistedBackgroundModels',
  'createTaskContextSourceSelector',
  'sessionPanelModel'
]

describe('rightpanel/panelConsumers (VP-33 · EP-14)', () => {
  it('keeps the full-history implementations in the reference fixture and all consumers on the indexed hook', () => {
    const reference = readFileSync(
      resolve(CHAT_ROOT, 'lib/transcriptIndex.legacy.testfixture.ts'),
      'utf8'
    )
    const owners = [
      'lib/parts.ts',
      'lib/taskBoard.ts',
      'lib/canonicalBackground.ts',
      'lib/taskContext.ts',
      'harnesses/opencode/rightpanel/model.ts'
    ]
    for (const name of scanNames) {
      expect(reference).toContain(`export function ${name}(`)
    }
    for (const rel of [...owners, ...CONSUMER_FILES]) {
      const src = readFileSync(resolve(CHAT_ROOT, rel), 'utf8')
      if (CONSUMER_FILES.some((file) => file === rel))
        expect(src, rel).toContain('useTranscriptView')
      expect(src, rel).not.toContain('transcriptIndex.legacy.testfixture')
      for (const name of scanNames) {
        expect(src, rel).not.toMatch(new RegExp(`(?<![.\\w])${name}\\s*\\(`))
      }
    }
  })

  it('unrelated text append on a 500-message session preserves panel view references with 0 reads of older parts', () => {
    const messages: Message[] = []
    for (let i = 0; i < 500; i++) {
      messages.push({
        id: `a:${i}`,
        role: 'assistant',
        createdAt: i * 10,
        parts: [{ type: 'text', text: `msg ${i}` }]
      })
    }
    let state = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's1',
        title: 't',
        agentKind: 'code',
        createdAt: 0,
        updatedAt: 0,
        messages
      } as never,
      complete: true
    })
    // Instrument old message parts getter before initial index warmup, then reset counter
    let oldReads = 0
    const guarded = state.messages.map((m, i) => {
      if (i >= 490) return m
      const rawParts = m.parts
      return Object.defineProperty({ ...m }, 'parts', {
        get() {
          oldReads++
          return rawParts
        },
        enumerable: true
      }) as Message
    })
    state = { ...state, messages: guarded }
    const idx1 = transcriptIndexFor(state)
    const board1 = idx1.taskBoard()
    const sources1 = idx1.taskContextSources()
    const subagents1 = idx1.subagentTasks()
    oldReads = 0

    // Append an unrelated text part to the last message via COMMIT_PENDING_TEXT
    state = chatReducer(state, {
      type: 'COMMIT_PENDING_TEXT',
      text: 'more prose',
      messageKey: 'a:499'
    })

    const idx2 = transcriptIndexFor(state)
    expect(idx2.taskBoard()).toBe(board1)
    expect(idx2.taskContextSources()).toBe(sources1)
    expect(idx2.subagentTasks()).toBe(subagents1)
    expect(oldReads).toBe(0)
  })
})
