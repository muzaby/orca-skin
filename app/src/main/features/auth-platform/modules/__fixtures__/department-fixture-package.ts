import type { RuntimeToolContribution } from '../../../../adapters/runtime-tools'
import type { ConnectorRuntimeV1 } from '../../../../contracts/connector-plugin'
import { createStaticCredentialProvider } from '../../providers/static-credential'
import type { AuthPluginPackage } from '../index'

const PLUGIN_ID = 'department-tools'
const PROVIDER_ID = 'department-pat'

const CONNECTORS = [
  {
    id: 'jira-platform',
    label: 'Jira Platform',
    baseUrl: 'https://jira.platform.example.invalid'
  },
  {
    id: 'jira-security',
    label: 'Jira Security',
    baseUrl: 'https://jira.security.example.invalid'
  },
  {
    id: 'confluence-rnd',
    label: 'Confluence R&D',
    baseUrl: 'https://confluence.rnd.example.invalid'
  }
] as const

function connectorRuntime(config: (typeof CONNECTORS)[number]): ConnectorRuntimeV1 {
  return {
    descriptor: {
      id: config.id,
      pluginId: PLUGIN_ID,
      apiVersion: 1,
      label: config.label,
      acceptedAuthProviders: [PROVIDER_ID],
      baseUrl: config.baseUrl,
      presentation: { location: 'header', name: 'Authorization', scheme: 'Bearer' }
    },
    start: async () => ({ health: 'ready' }),
    invoke: async (_ctx, request) => ({ ok: true, data: { operation: request.operation } }),
    stop: async () => undefined
  }
}

function runtimeTools(config: (typeof CONNECTORS)[number]): RuntimeToolContribution {
  const readName = `${config.id}-read`
  const writeName = `${config.id}-write`
  return {
    descriptor: {
      id: `${config.id}-tools`,
      pluginId: PLUGIN_ID,
      connectorId: config.id,
      apiVersion: 1,
      tools: [
        {
          name: readName,
          description: `Read fixture data from ${config.label}.`,
          annotations: { readOnlyHint: true }
        },
        {
          name: writeName,
          description: `Write fixture data to ${config.label}.`,
          annotations: { readOnlyHint: false }
        }
      ]
    },
    create: (ctx) => [
      { name: readName, inputSchema: {}, handler: (input) => ctx.invoke(readName, input) },
      { name: writeName, inputSchema: {}, handler: (input) => ctx.invoke(writeName, input) }
    ]
  }
}

const connectors = CONNECTORS.map(connectorRuntime)
const tools = CONNECTORS.map(runtimeTools)

export const departmentFixturePackage: AuthPluginPackage = {
  manifest: {
    schemaVersion: 1,
    id: PLUGIN_ID,
    version: '1.0.0',
    contributes: {
      authProviders: [
        {
          id: PROVIDER_ID,
          apiVersion: 1,
          label: 'Department PAT',
          targets: ['connector'],
          mechanisms: ['personal_access_token'],
          capabilities: ['logout']
        }
      ],
      connectors: connectors.map(({ descriptor }) => ({
        id: descriptor.id,
        apiVersion: descriptor.apiVersion,
        label: descriptor.label,
        acceptedAuthProviders: [...descriptor.acceptedAuthProviders],
        baseUrl: descriptor.baseUrl,
        presentation: descriptor.presentation
      })),
      runtimeTools: tools.map(({ descriptor }) => ({
        id: descriptor.id,
        connectorId: descriptor.connectorId,
        apiVersion: descriptor.apiVersion,
        tools: descriptor.tools
      }))
    }
  },
  providers: [
    createStaticCredentialProvider({
      id: PROVIDER_ID,
      pluginId: PLUGIN_ID,
      label: 'Department PAT',
      mechanism: 'personal_access_token'
    })
  ],
  connectors,
  runtimeTools: tools
}

export const badDepartmentFixturePackage: AuthPluginPackage = {
  ...departmentFixturePackage,
  manifest: {
    ...(departmentFixturePackage.manifest as Record<string, unknown>),
    id: 'broken-department-tools'
  }
}
