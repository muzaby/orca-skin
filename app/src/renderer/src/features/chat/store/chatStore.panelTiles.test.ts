import { beforeEach, expect, it } from 'vitest'
import { chatActions, getActiveChatSession, ingestChatEvent, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { panelActions, useRightPanelStore } from './rightPanelStore'
import { layerKey } from '../lib/rightPanelStack'

beforeEach(() => {
  installChatStoreHarness({ backend: 'opencode', agentKind: 'code' })
  useRightPanelStore.setState(useRightPanelStore.getInitialState())
  panelActions.switchSession({ key: 's', kind: 'code', backend: 'opencode' }, true)
})
it('opens process, source and subagent entries through the active session actions', () => {
  chatActions.setRightPanelTileActive('diff', true)
  chatActions.openSubagentTask('child')
  expect(useRightPanelStore.getState().stack.at(-1)).toMatchObject({
    kind: 'detail',
    selection: { id: 'subagent', selectedId: 'child' }
  })
  chatActions.openProcessTool('shell')
  chatActions.setRightPanelTileActive('source', true)
  expect(useRightPanelStore.getState().stack.map(layerKey)).toEqual([
    'task',
    'detail:subagent',
    'process',
    'source'
  ])
  expect(getActiveChatSession().selectedProcessToolId).toBe('shell')
  chatActions.openProcessTool('shell-2')
  expect(useRightPanelStore.getState().stack.at(-1)).toMatchObject({ id: 'process' })
  expect(getActiveChatSession().selectedProcessToolId).toBe('shell-2')
})
it.each(['work', 'code'] as const)(
  'filters unsupported Claude %s process and source entries',
  (kind) => {
    installChatStoreHarness({ backend: 'claude', agentKind: kind })
    panelActions.switchSession({ key: 's', kind, backend: 'claude' }, false)
    chatActions.openProcessTool('shell')
    chatActions.setRightPanelTileActive('source', true)
    expect(useRightPanelStore.getState().stack).toEqual([])
  }
)

it('AC9 only an active open panel navigates to an arriving plan review', () => {
  const review = (id: string) =>
    ingestChatEvent({
      type: 'permission.requested',
      sessionId: id,
      origin: 'agent',
      approvalId: 'approve',
      action: { kind: 'plan_review', request: { requestId: 'approve', plan: 'Review' } }
    })
  panelActions.close()
  review('s')
  expect(useRightPanelStore.getState().stack).toEqual([])
  panelActions.tile('task')
  const here = useChatStore.getState().sessions.s
  useChatStore.setState((state) => ({
    sessions: {
      ...state.sessions,
      other: { ...here, session: { ...here.session, sessionId: 'other' } }
    }
  }))
  review('other')
  expect(useRightPanelStore.getState().stack.map(layerKey)).toEqual(['task'])
  review('s')
  expect(useRightPanelStore.getState().stack.map(layerKey)).toEqual(['task', 'plan'])
})

it('AC9 beginning a user turn keeps a closed panel closed', () => {
  panelActions.close()
  expect(chatActions.send('begin turn')).toBe(true)
  expect(getActiveChatSession().inflight).toBe(true)
  expect(useRightPanelStore.getState().stack).toEqual([])
})
