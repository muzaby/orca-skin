import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isValidElement, type ReactElement } from 'react'

const listProjects = vi.hoisted(() => vi.fn())
vi.mock('./shared/api/ipc', () => ({
  projectApi: { list: listProjects },
  sessionApi: {},
  costApi: {},
  backendApi: {},
  settingsApi: {},
  bootApi: {}
}))
vi.mock('./shared/theme', () => ({
  TweakProvider: function TweakProvider() {
    return null
  }
}))
vi.mock('react-router-dom', () => ({
  BrowserRouter: function BrowserRouter() {
    return null
  }
}))
vi.mock('./features/backend', () => ({
  BackendProvider: function BackendProvider() {
    return null
  }
}))
vi.mock('./features/sessions', () => ({
  SessionsProvider: function SessionsProvider() {
    return null
  }
}))
vi.mock('./features/cost', () => ({
  CostProvider: function CostProvider() {
    return null
  }
}))
vi.mock('./features/update', () => ({
  UpdateProvider: function UpdateProvider() {
    return null
  }
}))
vi.mock('./features/chat', () => ({
  ChatProvider: function ChatProvider() {
    return null
  }
}))
vi.mock('./app/RootGate', () => ({
  RootGate: function RootGate() {
    return null
  }
}))

import App from './App'
import {
  createBootSteps,
  defaultBootDependencies,
  runBootSteps,
  type BootStep
} from './app/boot/steps'
import { useProjectsStore } from './features/projects/store/projectsStore'

beforeEach(() => {
  listProjects.mockReset()
  useProjectsStore.setState({ list: [], loading: true })
})

describe('project initialization stays in the boot owner', () => {
  const boot = (): BootStep[] =>
    createBootSteps({
      ...defaultBootDependencies,
      whenMainReady: async () => undefined,
      getBootReport: async () => ({
        startedAt: 1,
        finishedAt: 2,
        durationMs: 1,
        status: 'ok',
        steps: [],
        warnings: []
      }),
      getLastSessionId: async () => 's1',
      initBackend: async () => undefined,
      initSessions: async () => undefined,
      initUsage: async () => undefined
    })

  it('actual boot steps initialize the project store exactly once', async () => {
    const projects = [
      { id: 'p1', name: 'Project', instructions: '', createdAt: 1, updatedAt: 2, pinnedAt: null }
    ]
    listProjects.mockResolvedValue(projects)
    const events: string[] = []
    expect(
      await runBootSteps(boot(), (event) => events.push(`${event.id}:${event.status}`))
    ).toEqual({ landingTarget: '/chat/s1' })
    expect(useProjectsStore.getState()).toEqual({ list: projects, loading: false })
    expect(listProjects).toHaveBeenCalledTimes(1)
    expect(events).toContain('projects-cost:ok')
  })

  it('project failure preserves the list, ends loading and degrades without blocking landing', async () => {
    listProjects.mockRejectedValue(new Error('projects unavailable'))
    const retained = [
      { id: 'p1', name: 'Retained', instructions: '', createdAt: 1, updatedAt: 2, pinnedAt: null }
    ]
    useProjectsStore.setState({ list: retained, loading: true })
    const events: string[] = []
    expect(
      await runBootSteps(boot(), (event) => events.push(`${event.id}:${event.status}`))
    ).toEqual({ landingTarget: '/chat/s1' })
    expect(useProjectsStore.getState().list).toBe(retained)
    expect(useProjectsStore.getState().loading).toBe(false)
    expect(events).toContain('projects-cost:degraded')
  })

  it('App preserves the nesting order of all live providers and RootGate', () => {
    const names: string[] = []
    let node: unknown = App()
    while (isValidElement(node)) {
      const element = node as ReactElement<{ children?: unknown }>
      if (typeof element.type === 'function') names.push(element.type.name)
      node = element.props.children
    }
    expect(names).toEqual([
      'TweakProvider',
      'BrowserRouter',
      'BackendProvider',
      'SessionsProvider',
      'CostProvider',
      'UpdateProvider',
      'ChatProvider',
      'RootGate'
    ])
  })
})
