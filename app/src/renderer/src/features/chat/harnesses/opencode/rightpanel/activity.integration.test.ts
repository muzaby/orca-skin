import { describe, expect, it } from 'vitest'
import { OpenCodeActivityMapper } from '../../../../../../../main/adapters/opencode/v1/activity'
import {
  assistantMessage,
  editTool,
  openCodeEvent as event,
  textPart
} from '../../../../../../../main/adapters/opencode/v1/adapter.testfixture'
import {
  applyBackgroundEvent,
  emptyBackgroundState
} from '../../../../../../../shared/background-task'
import { chatReducer, initialChatState } from '../../../reducer/chatReducer'
import { childMessageForParentToolRunId, partsText } from '../../../lib/parts'
import { sessionPanelModel } from './model'

describe('OpenCode activity to panel projection', () => {
  it('consumes normalized child parts and journal progress through the production reducers', () => {
    const mapper = new OpenCodeActivityMapper('s1', 'prompt-1')
    let state = { ...initialChatState, sessionId: 's1' }
    let background = emptyBackgroundState()
    const events = [
      event('message.updated', { sessionID: 's1', info: assistantMessage() }),
      event('message.part.updated', {
        sessionID: 's1',
        time: 1,
        part: editTool({
          tool: 'task',
          callID: 'task',
          state: {
            status: 'running',
            input: { description: 'Inspect source' },
            metadata: { sessionId: 'child' },
            time: { start: 1 }
          }
        })
      }),
      event('message.updated', { sessionID: 'child', info: assistantMessage('child') }),
      event('message.part.updated', {
        sessionID: 'child',
        time: 2,
        part: textPart('Found source', { sessionID: 'child', time: { start: 1, end: 2 } })
      }),
      event('message.part.updated', {
        sessionID: 'child',
        time: 3,
        part: editTool({
          sessionID: 'child',
          tool: 'bash',
          callID: 'shell',
          state: {
            status: 'running',
            input: { command: 'npm test' },
            metadata: { output: 'tests running' },
            time: { start: 3 }
          }
        })
      })
    ]
    for (const value of events) {
      const batch = mapper.map(value)
      for (const item of batch.events)
        state = chatReducer(state, { type: 'RECV_EVENT', event: item }) as typeof state
      for (const item of batch.providerEvents) background = applyBackgroundEvent(background, item)
    }
    expect(partsText(state.messages.flatMap((message) => message.parts))).not.toContain(
      'Found source'
    )
    const child = childMessageForParentToolRunId(state.messages, 'task')
    expect(child && partsText(child.parts)).toBe('Found source')
    const model = sessionPanelModel(state.messages, background)
    expect(model.agents[0].description).toBe('Inspect source')
    expect(model.processes[0]).toMatchObject({
      id: 'child:shell',
      output: 'tests running',
      status: 'running'
    })
  })
})
