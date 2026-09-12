import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BackgroundModelLabel } from './BackgroundModelLabel'
import { SubAgentTaskList } from './SubAgentTileContent'
import { useChatStore } from '../../store/chatStore'
import { subagentTasksFromMessages } from '../../lib/parts'

describe('observed background model labels', () => {
  it('prefers canonical actual model, then live actual model, then persisted actual model', () => {
    const initial = useChatStore.getInitialState()
    const entry = initial.sessions[initial.activeKey]
    const saved = entry.subagentMeta
    entry.subagentMeta = { label: { model: 'claude-sonnet-4-5' } }
    try {
      const render = (model?: string, persistedModel?: string): string =>
        renderToStaticMarkup(
          createElement(BackgroundModelLabel, { toolUseId: 'label', model, persistedModel })
        )
      expect(render('claude-haiku-4-5', 'claude-opus-4-1')).toBe('Haiku 4.5')
      expect(render(undefined, 'claude-opus-4-1')).toBe('Sonnet 4.5')
      entry.subagentMeta = {}
      expect(render(undefined, 'claude-opus-4-1')).toBe('Opus 4.1')
      expect(render()).toBe('알 수 없음')
    } finally {
      entry.subagentMeta = saved
    }
  })
  it('legacy cards use persisted execution model and never treat requested model or Explore as observed', () => {
    const tasks = subagentTasksFromMessages([
      {
        role: 'assistant',
        createdAt: 1,
        parts: [
          {
            type: 'tool_call',
            toolRunId: 'legacy-model',
            toolName: 'Agent',
            args: { description: 'legacy title', model: 'opus', subagent_type: 'Explore' }
          },
          {
            type: 'tool_result',
            toolRunId: 'legacy-model',
            result: 'hidden result',
            isError: false,
            subagentMeta: { model: 'claude-haiku-4-5' }
          }
        ]
      }
    ])
    const render = (): string =>
      renderToStaticMarkup(
        createElement(SubAgentTaskList, { tasks, stoppingIds: new Set<string>(), stopErrors: {} })
      )
    expect(render()).toContain('Haiku 4.5')
    expect(render()).not.toContain('hidden result')
    delete tasks[0].call.result!.subagentMeta
    expect(render()).toContain('알 수 없음')
    expect(render()).not.toContain('Opus')
    expect(render()).not.toContain('Explore')
  })
})
