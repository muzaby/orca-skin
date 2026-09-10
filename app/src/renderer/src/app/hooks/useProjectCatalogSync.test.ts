import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NormalizedEvent } from '../../../../shared/ipc'
import { useProjectCatalogSync } from './useProjectCatalogSync'
import {
  projectNavActions,
  useProjectNavStore
} from '../../features/sessions/store/projectNavStore'

const h = vi.hoisted(() => ({
  receive: null as ((event: NormalizedEvent) => void) | null,
  cleanup: null as (() => void) | null,
  refresh: vi.fn(async () => {}),
  load: vi.fn(async () => {}),
  unsubscribe: vi.fn()
}))
vi.mock('react', () => ({
  useEffect: (setup: () => () => void) => {
    h.cleanup = setup()
  }
}))
vi.mock('../../shared/api/ipc', () => ({
  chatApi: {
    onEvent: (listener: (event: NormalizedEvent) => void) => {
      h.receive = listener
      return h.unsubscribe
    }
  }
}))
vi.mock('../../features/projects', () => ({ projectsActions: { refresh: h.refresh } }))
vi.mock('../../features/sessions', async () => {
  const { projectNavActions } = await import('../../features/sessions/store/projectNavStore')
  return { projectNavActions, sessionsActions: { loadProject: h.load } }
})
beforeEach(() => {
  vi.clearAllMocks()
  useProjectNavStore.setState({ expanded: {}, announced: new Set() })
})
const event = (projectId: string, created?: boolean): NormalizedEvent => ({
  type: 'session.updated',
  sessionId: 's1',
  patch: {
    projectId,
    ...(created !== undefined ? { projectCreated: created } : {})
  }
})

describe('newly created session projects expand from the main receipt', () => {
  it('ignores loading and existing projects, then expands the created ID before its catalog row arrives', () => {
    useProjectCatalogSync()
    expect(useProjectNavStore.getState().expanded).toEqual({})
    h.receive!(event('existing'))
    h.receive!(event('existing', false))
    expect(useProjectNavStore.getState().expanded).toEqual({})
    expect(h.refresh).not.toHaveBeenCalled()
    h.receive!(event('created', true))
    expect(useProjectNavStore.getState().expanded).toEqual({ created: true })
    expect(h.refresh).toHaveBeenCalledOnce()
    expect(h.load).toHaveBeenCalledWith('created')
    h.cleanup!()
    expect(h.unsubscribe).toHaveBeenCalledOnce()
  })

  it('preserves manual collapse across duplicate receipts, row remounts and existing-project activity', () => {
    useProjectCatalogSync()
    h.receive!(event('created', true))
    projectNavActions.setExpanded('created', false)
    h.receive!(event('created', true))
    h.receive!(event('created'))
    expect(useProjectNavStore.getState().expanded.created).toBe(false)
    expect(h.refresh).toHaveBeenCalledOnce()
    projectNavActions.setExpanded('already-shown', false)
    h.receive!(event('already-shown', true))
    expect(useProjectNavStore.getState().expanded['already-shown']).toBe(false)
    projectNavActions.setExpanded('existing', true)
    h.receive!(event('existing'))
    expect(useProjectNavStore.getState().expanded.existing).toBe(true)
  })
})
