import {
  CHANNELS,
  PluginConnectionConnectRequestSchema,
  PluginConnectionDisconnectRequestSchema,
  PluginConnectorInfoSchema,
  PluginListRequestSchema,
  type AuthLogoutOutcome,
  type PluginConnectorInfo
} from '../../../shared/protocol'
import { handle } from '../../infra/ipc/handle'
import type { PluginHost } from '../../features/auth-platform/plugin-host'

export function registerPluginHandlers(pluginHost: PluginHost): void {
  handle(CHANNELS.pluginList, PluginListRequestSchema, 'reject', (): PluginConnectorInfo[] => {
    return parsePluginListResponse(pluginHost.list())
  })
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

// PluginHost의 타입 선언과 별개로 IPC 직전에는 runtime DTO를 다시 좁힌다. 이 경계가
// 깨지면 credential/binding 등 main 전용 필드가 renderer에 노출되지 않도록 fail-closed 한다.
export function parsePluginListResponse(value: unknown): PluginConnectorInfo[] {
  return PluginConnectorInfoSchema.array().parse(value)
}
