import { expect, it, vi } from 'vitest'
import { createManagedMcpSource } from './managed-source'
import type { OrcaMcpConfig } from '../../../../adapters/common/mcp-config'
import type { ManagedMcpPlugin } from '../../../../adapters/common/managed-mcp'

it('separates definitions and desired choices through disable edit resolution rotation and revocation', () => {
  let definitions: OrcaMcpConfig = {
    first: { command: 'first' },
    secured: { command: 'tool', env: { TOKEN: '${TOKEN}' } }
  }
  let desired = { first: false, secured: false }
  let token: string | undefined = undefined
  let authorized = true,
    credential = 11
  const plugin = {
    identity: { kind: 'builtin', sourceId: 'builtin', name: 'Builtin', mentionId: 'builtin' },
    server: {
      descriptor: {
        id: 'plugin',
        connectorId: 'builtin',
        executionScope: 'application',
        tools: []
      },
      implementations: []
    },
    authorized: () => authorized,
    credentialRevision: () => credential
  } as ManagedMcpPlugin
  const changed = vi.fn()
  const source = createManagedMcpSource({
    users: () => ({}),
    definitions: () => ({ definitions, desired }),
    resolver: () => () => token,
    plugins: () => [plugin]
  })
  source.subscribe(changed)
  source.refresh()
  const initial = source.snapshot()
  expect(initial).toMatchObject({
    revision: 1,
    definitionRevision: 1,
    connectionRevision: 1,
    users: {},
    definitions: { first: { command: 'first' } }
  })
  expect(initial.definitions).not.toHaveProperty('secured')
  source.refresh()
  expect(changed).toHaveBeenCalledTimes(1)
  desired = { ...desired, first: true }
  source.refresh()
  expect(source.snapshot()).toMatchObject({
    revision: 2,
    definitionRevision: 1,
    connectionRevision: 2,
    users: { first: { command: 'first' } }
  })
  expect(changed).toHaveBeenLastCalledWith(2, 'connections')
  desired = { ...desired, first: false }
  source.refresh()
  expect(source.snapshot().definitionRevision).toBe(1)
  definitions = { ...definitions, first: { command: 'edited' } }
  source.refresh()
  expect(source.snapshot()).toMatchObject({
    definitionRevision: 2,
    users: {},
    definitions: { first: { command: 'edited' } }
  })
  token = 'resolved-secret'
  source.refresh()
  expect(source.snapshot()).toMatchObject({
    definitionRevision: 3,
    users: {},
    definitions: { secured: { env: { TOKEN: 'resolved-secret' } } }
  })
  desired = { ...desired, secured: true }
  source.refresh()
  expect(source.snapshot().definitionRevision).toBe(3)
  credential++
  source.refresh()
  expect(source.snapshot().definitionRevision).toBe(4)
  authorized = false
  source.refresh()
  expect(source.snapshot().plugins.size).toBe(0)
  expect(source.snapshot().definitionRevision).toBe(5)
  expect(changed).toHaveBeenLastCalledWith(8, 'definitions')
  const cloned = source.snapshot()
  cloned.definitions!.first = { command: 'mutated' }
  cloned.desired!.first = true
  expect(source.snapshot().definitions!.first).toEqual({ command: 'edited' })
  expect(source.snapshot().desired!.first).toBe(false)
})
