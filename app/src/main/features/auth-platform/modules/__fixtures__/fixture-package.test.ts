import { describe, expect, it } from 'vitest'
import type { AuthBindingInfo, AuthLogoutOutcome } from '../../../../../shared/ipc'
import { PluginHost } from '../../plugin-host'
import { AuthRegistry } from '../../registry'
import { badDepartmentFixturePackage, departmentFixturePackage } from './department-fixture-package'

describe('department static connector fixture package', () => {
  it('registers three fixed department connectors with distinct list DTO inputs', () => {
    const registry = new AuthRegistry()

    expect(registry.register(departmentFixturePackage)).toEqual([])
    expect(registry.validateCrossReferences()).toEqual([])
    expect(
      registry.listConnectors().map((connector) => ({
        connectorId: connector.descriptor.id,
        label: connector.descriptor.label,
        origin: connector.descriptor.baseUrl,
        pluginId: connector.descriptor.pluginId,
        acceptedAuthProviders: connector.descriptor.acceptedAuthProviders
      }))
    ).toEqual([
      {
        connectorId: 'jira-platform',
        label: 'Jira Platform',
        origin: 'https://jira.platform.example.invalid',
        pluginId: 'department-tools',
        acceptedAuthProviders: ['department-pat']
      },
      {
        connectorId: 'jira-security',
        label: 'Jira Security',
        origin: 'https://jira.security.example.invalid',
        pluginId: 'department-tools',
        acceptedAuthProviders: ['department-pat']
      },
      {
        connectorId: 'confluence-rnd',
        label: 'Confluence R&D',
        origin: 'https://confluence.rnd.example.invalid',
        pluginId: 'department-tools',
        acceptedAuthProviders: ['department-pat']
      }
    ])
  })

  it('lists every fixed connector and reports only the connected fixture as connected', async () => {
    const registry = new AuthRegistry()
    registry.register(departmentFixturePackage)
    const binding: AuthBindingInfo = {
      id: 'fixture-binding',
      pluginId: 'department-tools',
      providerId: 'department-pat',
      target: {
        kind: 'connector',
        connectorId: 'jira-platform',
        connectionId: 'fixture-connection'
      },
      mechanism: 'personal_access_token',
      artifact: {
        kind: 'vault_credential',
        handleId: 'fixture-secret-handle',
        credentialKind: 'personal_access_token'
      },
      status: 'valid',
      createdAt: 1
    }
    const host = new PluginHost({
      registry,
      bindings: { getBinding: (bindingId) => (bindingId === binding.id ? binding : undefined) },
      connectors: {
        connect: async () => ({ health: 'ready' }),
        invoke: async () => ({ ok: true, data: null }),
        stopByBinding: async () => undefined
      },
      logout: {
        logout: async (): Promise<AuthLogoutOutcome> => ({
          kind: 'logged_out',
          endedBindingIds: []
        })
      },
      runtimeTools: { add: () => undefined, remove: () => undefined }
    })

    await host.connect({ connectorId: 'jira-platform', bindingId: binding.id })

    expect(host.list().map(({ connectorId, connected }) => ({ connectorId, connected }))).toEqual([
      { connectorId: 'jira-platform', connected: true },
      { connectorId: 'jira-security', connected: false },
      { connectorId: 'confluence-rnd', connected: false }
    ])
  })

  it('contributes a read-only and a write runtime tool for its static connectors', () => {
    const registry = new AuthRegistry()
    registry.register(departmentFixturePackage)

    const tools = registry.listRuntimeTools().flatMap((server) => server.descriptor.tools)
    expect(tools.some((tool) => tool.annotations?.readOnlyHint === true)).toBe(true)
    expect(tools.some((tool) => tool.annotations?.readOnlyHint === false)).toBe(true)
    expect(
      new Set(registry.listRuntimeTools().map((server) => server.descriptor.connectorId))
    ).toEqual(new Set(['jira-platform', 'jira-security', 'confluence-rnd']))
  })

  it('isolates a rejected package while the valid fixture still connects and adds its tools', async () => {
    const registry = new AuthRegistry()
    const binding: AuthBindingInfo = {
      id: 'fixture-binding',
      pluginId: 'department-tools',
      providerId: 'department-pat',
      target: {
        kind: 'connector',
        connectorId: 'jira-platform',
        connectionId: 'fixture-connection'
      },
      mechanism: 'personal_access_token',
      artifact: {
        kind: 'vault_credential',
        handleId: 'fixture-secret-handle',
        credentialKind: 'personal_access_token'
      },
      status: 'valid',
      createdAt: 1
    }
    const servers = new Map<string, unknown>()
    const host = new PluginHost({
      registry,
      bindings: { getBinding: (bindingId) => (bindingId === binding.id ? binding : undefined) },
      connectors: {
        connect: async () => ({ health: 'ready' }),
        invoke: async () => ({ ok: true, data: null }),
        stopByBinding: async () => undefined
      },
      logout: {
        logout: async (): Promise<AuthLogoutOutcome> => ({
          kind: 'logged_out',
          endedBindingIds: []
        })
      },
      runtimeTools: {
        add: (server) => servers.set(server.descriptor.id, server),
        remove: (serverId) => servers.delete(serverId)
      }
    })

    expect(registry.register(badDepartmentFixturePackage)).not.toEqual([])
    expect(registry.register(departmentFixturePackage)).toEqual([])
    await host.connect({ connectorId: 'jira-platform', bindingId: binding.id })

    expect(registry.listConnectors().map((connector) => connector.descriptor.id)).toEqual([
      'jira-platform',
      'jira-security',
      'confluence-rnd'
    ])
    expect(host.list()).toContainEqual(
      expect.objectContaining({ connectorId: 'jira-platform', connected: true })
    )
    expect(servers.has('jira-platform-tools')).toBe(true)
  })
})
