import { afterEach, describe, expect, it } from 'vitest'
import {
  chatActions,
  getActiveChatSession,
  seedLandingBackend,
  seedLandingAgentKind,
  useChatStore
} from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { draftSelection } from '../components/composer/modelSelection'
import type { AgentEnvironment } from '../../../../../shared/ipc'

afterEach(() => {
  seedLandingBackend(null)
  seedLandingAgentKind('work')
})
describe('remembered harness and request routing', () => {
  it('reveals the supported OpenCode subagent panel through store actions', () => {
    installChatStoreHarness({
      backend: 'opencode',
      agentKind: 'code',
      rightPanelTiles: [{ id: 'stale', tiles: ['subagent'] }]
    })
    chatActions.setRightPanelTileActive('subagent', true)
    expect(useChatStore.getState().sessions.s.panelReveal?.id).toBe('subagent')
    chatActions.toggleRightPanelTile('subagent')
    expect(useChatStore.getState().sessions.s.panelReveal?.id).toBe('subagent')
  })
  it('defaults to Claude, remembers model selection and sends native options', () => {
    const { settingsSet, chatSend } = installChatStoreHarness({ sessionId: null })
    seedLandingBackend(null)
    expect(getActiveChatSession().backend).toBe('claude')
    chatActions.setModel('opencode-local', 'vendor/model', 'Model', 'opencode')
    chatActions.setHarnessOptions({ agent: 'build', variant: 'high' })
    expect(settingsSet).toHaveBeenCalledWith({ lastBackend: 'opencode' })
    expect(chatActions.send('keep my input')).toBe(true)
    expect(chatSend.mock.calls[0][0]).toMatchObject({
      backend: 'opencode',
      agentKind: 'code',
      harnessAgent: 'build',
      modelVariant: 'high',
      text: 'keep my input'
    })
  })
  it('late landing settings never replace a restored session harness', () => {
    installChatStoreHarness({ sessionId: 's', backend: 'opencode', agentKind: 'code' })
    const before = useChatStore.getState().sessions.s
    seedLandingBackend('claude')
    expect(useChatStore.getState().sessions.s).toBe(before)
  })
  it('only unsent drafts fall back when the remembered harness has no models', () => {
    const agents: AgentEnvironment[] = [
      {
        key: 'claude-local',
        adapter: 'claude',
        provider: 'local',
        supported: true,
        models: [
          {
            alias: 'sonnet',
            model: null,
            isCustom: false,
            isDefault: true,
            oneMillionContext: false
          }
        ]
      }
    ]
    expect(draftSelection(agents, 'opencode', false)?.adapter).toBe('claude')
    expect(draftSelection(agents, 'opencode', true)).toBeNull()
    expect(draftSelection([{ ...agents[0], models: [] }], 'claude', false)).toBeNull()
  })
})
