import {
  CHANNELS,
  PluginConnectionConnectRequestSchema,
  PluginConnectionDisconnectRequestSchema,
  PluginListRequestSchema,
  type AuthLogoutOutcome,
  type PluginConnectorInfo
} from '../../../shared/protocol'
import { handle } from '../../infra/ipc/handle'
import type { PluginHost } from '../../features/auth-platform/plugin-host'

export function registerPluginHandlers(pluginHost: PluginHost): void {
  handle(CHANNELS.pluginList, PluginListRequestSchema, 'reject', (): PluginConnectorInfo[] =>
    pluginHost.list()
  )
  handle(
    CHANNELS.pluginConnectionConnect,
    PluginConnectionConnectRequestSchema,
    'reject',
    async (request): Promise<void> => pluginHost.connect(request)
  )
  handle(
    CHANNELS.pluginConnectionDisconnect,
    PluginConnectionDisconnectRequestSchema,
    'reject',
    (request): Promise<AuthLogoutOutcome> => pluginHost.disconnect(request)
  )
}
