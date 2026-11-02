import { afterEach, expect, it, vi } from 'vitest'
import {
  useChatStore,
  applyHarnessAvailability,
  seedLandingBackend,
  chatActions
} from './chatStore'
import { useHarnessAvailabilityStore } from '../../../shared/stores/harnessAvailabilityStore'
import { settingsApi } from '../../../shared/api/ipc'
const before = useChatStore.getState()
afterEach(() => {
  useChatStore.setState(before, true)
  vi.restoreAllMocks()
})
it('falls back main/project drafts including explicit OpenCode selection while preserving stored sessions and preferences', () => {
  const set = vi.spyOn(settingsApi, 'set').mockResolvedValue({} as never)
  useHarnessAvailabilityStore.setState(({ byId }) => ({
    byId: { ...byId, opencode: { id: 'opencode', installed: true, usable: true } }
  }))
  seedLandingBackend('opencode')
  const entry = before.sessions[before.activeKey]
  const draft = {
    ...entry,
    session: {
      ...entry.session,
      sessionId: null,
      backend: 'opencode' as const,
      harnessExplicitlySelected: true
    }
  }
  const saved = { ...draft, session: { ...draft.session, sessionId: 'saved' } }
  const claude = { ...entry, session: { ...entry.session, backend: 'claude' as const } }
  useChatStore.setState({
    activeKey: 'draft',
    sessions: {
      draft,
      project: { ...draft, session: { ...draft.session, pendingProjectId: 'project' } },
      saved,
      claude
    }
  })
  useHarnessAvailabilityStore.setState(({ byId }) => ({
    byId: {
      ...byId,
      opencode: { id: 'opencode', installed: false, usable: false, unavailableReason: 'missing' }
    }
  }))
  applyHarnessAvailability()
  const result = useChatStore.getState().sessions
  expect(result.draft.session.backend).toBe('claude')
  expect(result.project.session.backend).toBe('claude')
  expect(result.saved).toBe(saved)
  expect(result.claude).toBe(claude)
  expect(set).not.toHaveBeenCalled()
  chatActions.setModel('claude-local', 'claude/model', 'Claude', 'claude')
  expect(set).not.toHaveBeenCalled()
  chatActions.setModel('claude-local', 'claude/model', 'Claude', 'claude', {
    explicitHarness: true
  })
  expect(set).toHaveBeenCalledWith({ lastBackend: 'claude' })
})
it('seeds Claude for an unavailable lastBackend and keeps ready OpenCode selections', () => {
  const entry = before.sessions[before.activeKey]
  useChatStore.setState({
    sessions: {
      [before.activeKey]: {
        ...entry,
        session: {
          ...entry.session,
          sessionId: null,
          agentKindLocked: false,
          harnessExplicitlySelected: false
        }
      }
    }
  })
  useHarnessAvailabilityStore.setState(({ byId }) => ({
    byId: {
      ...byId,
      opencode: { id: 'opencode', installed: false, usable: false, unavailableReason: 'failed' }
    }
  }))
  seedLandingBackend('opencode')
  expect(useChatStore.getState().sessions[before.activeKey].session.backend).toBe('claude')
  useHarnessAvailabilityStore.setState(({ byId }) => ({
    byId: { ...byId, opencode: { id: 'opencode', installed: true, usable: true } }
  }))
  seedLandingBackend('opencode')
  expect(useChatStore.getState().sessions[before.activeKey].session.backend).toBe('opencode')
})
