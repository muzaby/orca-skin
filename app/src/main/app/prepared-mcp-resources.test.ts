import { expect, it, vi } from 'vitest'
import type { ComposerCatalogLease, ComposerCatalogScope } from '../../shared/composer-catalog'
import { preparedMcpScope, PreparedMcpResources } from './prepared-mcp-resources'

it('resolves draft execution choices and saved session scope from their actual owners', () => {
  const getSessionById = vi.fn()
  const db = { getSessionById }
  expect(
    preparedMcpScope(db, {
      backend: 'opencode',
      cwd: 'C:/draft',
      projectId: 'draft-project',
      providerKey: 'draft-provider',
      agentKind: 'code'
    })
  ).toEqual({
    backend: 'opencode',
    sessionId: null,
    cwd: 'C:/draft',
    projectId: 'draft-project',
    providerKey: 'draft-provider',
    agentKind: 'code'
  })
  expect(preparedMcpScope(db, { backend: 'opencode', cwd: null, projectId: null })).toMatchObject({
    providerKey: null,
    agentKind: 'code'
  })
  getSessionById.mockReturnValue({
    id: 'stored',
    backend: 'opencode',
    cwd: 'C:/stored',
    project_id: 'stored-project',
    agent_kind: 'code'
  })
  expect(preparedMcpScope(db, { sessionId: 'stored' })).toEqual({
    backend: 'opencode',
    sessionId: 'stored',
    cwd: 'C:/stored',
    projectId: 'stored-project',
    providerKey: null,
    agentKind: 'code'
  })
  expect(getSessionById).toHaveBeenCalledWith('stored')
  getSessionById.mockReturnValue(undefined)
  expect(preparedMcpScope(db, { sessionId: 'missing' })).toBeUndefined()
  expect(
    preparedMcpScope(db, { backend: 'claude', cwd: 'C:/claude', projectId: null })
  ).toBeUndefined()
})

it('keeps observed preparations alive and discards retired completions', async () => {
  const scope: ComposerCatalogScope = {
    backend: 'opencode',
    sessionId: null,
    cwd: 'C:/distinct',
    projectId: null,
    providerKey: 'distinct-provider',
    agentKind: 'work'
  }
  const request = {
    backend: 'opencode' as const,
    cwd: scope.cwd,
    projectId: null,
    providerKey: scope.providerKey,
    agentKind: scope.agentKind
  }
  let sequence = 0
  const releases: ReturnType<typeof vi.fn>[] = []
  const prepare = vi.fn(async (value: ComposerCatalogScope): Promise<ComposerCatalogLease> => {
    expect(value).toEqual(scope)
    const generation = `prepared-${++sequence}`
    const release = vi.fn(async () => {})
    releases.push(release)
    return {
      generation,
      signal: new AbortController().signal,
      release,
      read: async () =>
        [
          {
            id: generation,
            name: 'distinct managed MCP',
            kind: 'mcp',
            origin: 'orca',
            managedSource: { kind: 'user', sourceId: 'stored-user' },
            status: 'connected',
            enabled: true,
            canToggle: false
          }
        ] as never
    }
  })
  const resources = new PreparedMcpResources({ scope: () => scope, prepare })
  try {
    expect(await resources.read(request)).toBeUndefined()
    resources.observe(4, { owner: 'composer-A', active: true }, request)
    expect(await resources.read(request)).toMatchObject({
      state: 'connected',
      generation: 'prepared-1',
      items: [
        expect.objectContaining({
          id: 'prepared-1',
          managedSource: { kind: 'user', sourceId: 'stored-user' }
        })
      ]
    })
    expect(releases[0]).not.toHaveBeenCalled()
    resources.invalidate()
    expect(releases[0]).toHaveBeenCalledTimes(1)
    expect(await resources.read(request)).toMatchObject({ generation: 'prepared-2' })
    resources.releaseSender(4)
    expect(releases[1]).toHaveBeenCalledTimes(1)
    expect(await resources.read(request)).toBeUndefined()
    let complete!: (lease: ComposerCatalogLease) => void
    prepare.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    resources.observe(5, { owner: 'late', active: true }, request)
    const pending = resources.read(request)
    const cancelled = expect(pending).resolves.toEqual({
      state: 'disconnected',
      partial: true,
      items: []
    })
    await Promise.resolve()
    resources.releaseSender(5)
    const release = vi.fn(async () => {})
    complete({ generation: 'late', signal: new AbortController().signal, read: vi.fn(), release })
    await cancelled
    await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(1))
    resources.observe(6, { owner: 'shutdown', active: true }, request)
    await resources.read(request)
    resources.close()
    resources.close()
    expect(releases.at(-1)).toHaveBeenCalledTimes(1)
    expect(await resources.read(request)).toBeUndefined()
  } finally {
    resources.close()
  }
})
