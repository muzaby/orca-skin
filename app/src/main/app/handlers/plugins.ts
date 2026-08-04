import {
  CHANNELS,
  ConnectorTemplateInfoSchema,
  PluginConnectionConnectRequestSchema,
  PluginConnectionDisconnectRequestSchema,
  PluginConnectorInfoSchema,
  PluginDiagnosticSchema,
  PluginDiagnosticsRequestSchema,
  PluginInstanceCreateRequestSchema,
  PluginInstanceDeleteRequestSchema,
  PluginListRequestSchema,
  PluginTemplateListRequestSchema,
  type AuthLogoutOutcome,
  type ConnectorTemplateInfoDto,
  type PluginConnectorInfo,
  type PluginDiagnostic
} from '../../../shared/protocol'
import { handle } from '../../infra/ipc/handle'
import type { PluginHost } from '../../features/auth-platform/plugin-host'
import type { ConnectorInstanceLifecycle } from '../../features/connectors/instance-lifecycle'
import type { ConnectorTemplateRegistry } from '../../features/connectors/templates'

export interface PluginHandlerDeps {
  pluginHost: PluginHost
  templates: ConnectorTemplateRegistry
  instances: ConnectorInstanceLifecycle
  // 부팅 때 거부된 패키지·인스턴스 (0164 r2). `createAuthPlatform()` 이 동기적으로 다 채운 뒤
  // 핸들러가 등록되므로 값은 이미 확정돼 있다.
  diagnostics: readonly PluginDiagnostic[]
}

export function registerPluginHandlers(deps: PluginHandlerDeps): void {
  const { pluginHost, templates, instances } = deps

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

  // ── 인스턴스 CRUD (0161) ──────────────────────────────────────────────────
  //
  // **수정 채널이 없다.** connector ID 가 주소에서 파생되므로 주소 수정은 도구 이름·승인 키·
  // 다운로드 경로의 이동이다 — 삭제 후 재생성이 그 사실을 정직하게 드러낸다.
  //
  // 생성/삭제가 **갱신된 목록을 반환한다** — renderer 가 곧바로 다시 list 를 부르지 않아도
  // 되고, "만들었는데 목록에 없다" 는 중간 상태가 생기지 않는다.
  handle(
    CHANNELS.pluginTemplateList,
    PluginTemplateListRequestSchema,
    'reject',
    (): ConnectorTemplateInfoDto[] => parseTemplateListResponse(templates.describe())
  )
  handle(
    CHANNELS.pluginInstanceCreate,
    PluginInstanceCreateRequestSchema,
    'reject',
    async (request): Promise<PluginConnectorInfo[]> => {
      const result = await instances.create(request)
      // 실패 사유를 메시지에 실어 올린다 — renderer 가 이 문자열을 분류해 안내를 고른다.
      if (!result.ok) {
        throw new Error(
          `${result.reason}${result.detail !== undefined ? `: ${result.detail}` : ''}`
        )
      }
      return parsePluginListResponse(pluginHost.list())
    }
  )
  handle(
    CHANNELS.pluginInstanceDelete,
    PluginInstanceDeleteRequestSchema,
    'reject',
    async (request): Promise<PluginConnectorInfo[]> => {
      const result = await instances.remove(request.connectorId)
      if (!result.ok) {
        throw new Error(
          `${result.reason}${result.detail !== undefined ? `: ${result.detail}` : ''}`
        )
      }
      return parsePluginListResponse(pluginHost.list())
    }
  )
}

// PluginHost의 타입 선언과 별개로 IPC 직전에는 runtime DTO를 다시 좁힌다. 이 경계가
// 깨지면 credential/binding 등 main 전용 필드가 renderer에 노출되지 않도록 fail-closed 한다.
export function parsePluginListResponse(value: unknown): PluginConnectorInfo[] {
  return PluginConnectorInfoSchema.array().parse(value)
}

export function parseTemplateListResponse(value: unknown): ConnectorTemplateInfoDto[] {
  return ConnectorTemplateInfoSchema.array().parse(value)
}
