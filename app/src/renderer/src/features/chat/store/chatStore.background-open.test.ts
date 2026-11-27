import { beforeEach, describe, expect, it } from 'vitest'
import {
  backgroundKey,
  emptyBackgroundState,
  type BackgroundSessionState
} from '../../../../../shared/background-task'
import { chatActions } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { useBackgroundStore } from './backgroundStore'
import { panelActions, useRightPanelStore } from './rightPanelStore'
import { backgroundPanelSelection, projectBackgroundPanel } from '../lib/canonicalBackground'

beforeEach(() => {
  useRightPanelStore.setState(useRightPanelStore.getInitialState())
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
      const entry = useRightPanelStore.getState().stack.at(-1)
      if (entry?.kind !== 'detail' || entry.selection.id !== 'subagent')
        throw new Error('Expected subagent detail')
      expect(entry.selection).toEqual({ id: 'subagent', backgroundKind: 'call', selectedId: key })
      const selection = backgroundPanelSelection(state, entry.selection)
      const projected = projectBackgroundPanel(state, selection)
      expect(projected.selectedCall).toBe(state.calls[key])
      expect(projected.calls).toEqual([])
      expect(projected.tasks).toEqual([])
      panelActions.back()
      expect(useRightPanelStore.getState().stack.at(-1)?.kind).toBe('tile')
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
