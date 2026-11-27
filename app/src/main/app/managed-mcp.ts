import type { NativeResource } from '../../shared/native-resources'
import { managedChoiceKey } from '../adapters/common/extension-control'
import type { McpStore } from '../features/extensions/common/mcp/store'
import { createManagedMcpSource } from '../features/extensions/common/mcp/managed-source'
import { ManagedMcpBridge } from '../features/extensions/common/mcp/bridge'
import type { PluginBinding } from './deployment/plugins'
import { reportError } from '../infra/error-report'

export function createManagedMcp(
  mcp: Pick<McpStore, 'enabledConfig' | 'resolver'> &
    Partial<Pick<McpStore, 'executionDefinitions'>>,
  plugins: readonly PluginBinding[]
): {
  source: ReturnType<typeof createManagedMcpSource>
  catalog(): NativeResource[]
  mcpBridge: ManagedMcpBridge
} {
  const source = createManagedMcpSource({
    users: () => mcp.enabledConfig(),
    ...(mcp.executionDefinitions ? { definitions: () => mcp.executionDefinitions!() } : {}),
    resolver: () => mcp.resolver(),
    unresolved: (sourceId) =>
      reportError({
        event: 'managed-mcp.unresolved',
        scope: 'engine',
        title: 'engineInternal',
        level: 'warn',
        detail:
          'MCP 인증값을 해석하지 못하여 해당 연결을 제외했습니다. 플러그인 설정을 확인해 주세요.',
        data: { sourceId }
      }),
    plugins: () =>
      plugins.map((plugin) => ({
        identity: {
          kind: 'builtin' as const,
          sourceId: plugin.auth.authId,
          name: plugin.catalog.title?.ko ?? plugin.auth.authId,
          mentionId: plugin.auth.authId
        },
        server: plugin.server,
        authorized: () => plugin.auth.snapshot().status === 'valid',
        credentialRevision: () => plugin.auth.snapshot().credentialRevision
      }))
  })
  source.refresh()
  return {
    source,
    mcpBridge: new ManagedMcpBridge(source),
    catalog: () => {
      const all = mcp.executionDefinitions?.()
      const users = Object.keys(all?.definitions ?? mcp.enabledConfig())
      const item = (
        kind: 'builtin' | 'user',
        sourceId: string,
        name: string,
        selected: boolean,
        authorized: boolean
      ): NativeResource => ({
        id: managedChoiceKey(kind, sourceId),
        name,
        kind: 'mcp',
        origin: 'orcinus-orca',
        managedSource: { kind, sourceId },
        canOpen: false,
        canToggle: true,
        enabled: selected && authorized,
        selected,
        status: !authorized ? 'needs-auth' : selected ? 'configured' : 'disabled'
      })
      return [
        ...plugins
          .filter((p) => p.server.descriptor.executionScope === 'application')
          .map((p) =>
            item(
              'builtin',
              p.auth.authId,
              p.catalog.title?.ko ?? p.auth.authId,
              true,
              p.auth.snapshot().status === 'valid'
            )
          ),
        ...users.map((id) => item('user', id, id, all?.desired[id] ?? true, true))
      ]
    }
  }
}
