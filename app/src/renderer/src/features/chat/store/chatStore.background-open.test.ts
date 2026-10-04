import { beforeEach, describe, expect, it } from 'vitest'
import {
  backgroundKey,
  emptyBackgroundState,
  type BackgroundSessionState
} from '../../../../../shared/background-task'
import { chatActions } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { useBackgroundStore } from './backgroundStore'
import { projectBackgroundPanel } from '../lib/canonicalBackground'

beforeEach(() => {
  installChatStoreHarness({ agentKind: 'code' })
  useBackgroundStore.setState({ sessions: {}, panels: {} })
})

describe('0249 inline Agent opens canonical transcript without a foreground card', () => {
  it.each(['Agent', 'Task'])(
    '%s explicitly selects its hidden call and returning shows no card',
    (toolName) => {
      const key = backgroundKey('g1', 'tool')
      const state: BackgroundSessionState = {
        ...emptyBackgroundState(),
        generation: 'g1',
        calls: {
          [key]: {
            generation: 'g1',
            toolUseId: 'tool',
            toolName,
            phase: 'started',
            awaitingTask: false,
            status: 'running',
            firstSeenAt: 1,
            lastSeenAt: 1
          }
        }
      }
      useBackgroundStore.setState({ sessions: { s: { state, loading: false } } })
      chatActions.openSubagentTask('tool')
      const selection = useBackgroundStore.getState().sessions.s.selection
      expect(selection).toEqual({ kind: 'call', key })
      const projected = projectBackgroundPanel(state, selection)
      expect(projected.selectedCall).toBe(state.calls[key])
      expect(projected.calls).toEqual([])
      expect(projected.tasks).toEqual([])
      expect(projectBackgroundPanel(state).selectedCall).toBeUndefined()
    }
  )
  it('a hidden failed ordinary call is never exposed as a detail', () => {
    const key = backgroundKey('g1', 'read')
    const state: BackgroundSessionState = {
      ...emptyBackgroundState(),
      generation: 'g1',
      calls: {
        [key]: {
          generation: 'g1',
          toolUseId: 'read',
          toolName: 'Read',
          phase: 'returned',
          awaitingTask: false,
          status: 'failed',
          firstSeenAt: 1,
          lastSeenAt: 1
        }
      }
    }
    expect(projectBackgroundPanel(state, { kind: 'call', key }).selectedCall).toBeUndefined()
  })
})
