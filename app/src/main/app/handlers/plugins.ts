import {
  CHANNELS,
  PluginConnectionConnectRequestSchema,
  PluginConnectionDisconnectRequestSchema,
  PluginConnectorInfoSchema,
  PluginDiagnosticSchema,
  PluginDiagnosticsRequestSchema,
  PluginListRequestSchema,
  type AuthLogoutOutcome,
  type PluginConnectorInfo,
  type PluginDiagnostic
} from '../../../shared/protocol'
import { handle } from '../../infra/ipc/handle'
import type { PluginHost } from '../../features/auth-platform/plugin-host'

interface PluginHandlerDeps {
  pluginHost: PluginHost
  // 부팅 때 거부된 패키지 (0164 r2). `createAuthPlatform()` 이 동기적으로 다 채운 뒤
  // 핸들러가 등록되므로 값은 이미 확정돼 있다.
  diagnostics: readonly PluginDiagnostic[]
}

export function registerPluginHandlers(deps: PluginHandlerDeps): void {
  const { pluginHost } = deps

  handle(CHANNELS.pluginList, PluginListRequestSchema, 'reject', (): PluginConnectorInfo[] => {
    return parsePluginListResponse(pluginHost.list())
  })

  // 등록 진단. 목록이 비어 보이는 이유를 화면에서 읽을 수 있어야 한다 — 등록은 패키지 단위
  // all-or-nothing 이라 `baseUrl` 하나가 잘못되면 그 패키지의 서버가 전부 사라진다.
  handle(
    CHANNELS.pluginDiagnostics,
    PluginDiagnosticsRequestSchema,
    'reject',
    (): PluginDiagnostic[] => PluginDiagnosticSchema.array().parse(deps.diagnostics)
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

// PluginHost의 타입 선언과 별개로 IPC 직전에는 runtime DTO를 다시 좁힌다. 이 경계가
// 깨지면 credential/binding 등 main 전용 필드가 renderer에 노출되지 않도록 fail-closed 한다.
export function parsePluginListResponse(value: unknown): PluginConnectorInfo[] {
  return PluginConnectorInfoSchema.array().parse(value)
}
