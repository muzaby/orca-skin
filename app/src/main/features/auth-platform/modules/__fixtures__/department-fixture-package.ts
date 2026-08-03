import type { RuntimeToolContribution, RuntimeToolResult } from '../../../../adapters/runtime-tools'
import type { ConnectorResult } from '../../../../contracts/connector-plugin'
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

// ★ 플러그인 저자가 따라 써야 하는 부분. `ctx.invoke` 가 주는 `ConnectorResult` 를 **반드시**
// MCP 도구 결과로 옮긴다 — 그대로 반환하면 `content` 가 없어 모델에게 "성공, 결과 없음" 으로
// 보이고 connector 오류까지 성공으로 뒤집힌다(0158 verify r1 D5). 실패는 `isError` 로 싣는다.
// (연결 자체가 끊긴 경우는 `ctx.invoke` 가 던지고 SDK 가 isError 로 변환하므로 여기 오지 않는다.)
// `ctx.invoke` 는 backend 중립을 지키려고 `unknown` 을 준다(adapters 는 contracts 를 import 할 수
// 없다 — main DAG). 저자가 좁히는 것이 계약이므로 fixture 도 좁혀서 보여준다.
function toToolResult(raw: unknown): RuntimeToolResult {
  const result = raw as ConnectorResult | undefined
  if (result === null || typeof result !== 'object' || typeof result?.ok !== 'boolean') {
    return {
      content: [{ type: 'text', text: 'connector returned an unexpected result' }],
      isError: true
    }
  }
  if (!result.ok) {
    return { content: [{ type: 'text', text: result.message }], isError: true }
  }
  return { content: [{ type: 'text', text: JSON.stringify(result.data) }] }
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
      {
        name: readName,
        inputSchema: {},
        handler: async (input) => toToolResult(await ctx.invoke(readName, input))
      },
      {
        name: writeName,
        inputSchema: {},
        handler: async (input) => toToolResult(await ctx.invoke(writeName, input))
      }
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
