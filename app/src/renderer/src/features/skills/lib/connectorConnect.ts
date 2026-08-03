// Connector 연결 흐름의 **순수 로직** (0160) — React 비의존.
//
// 모달이 하는 일은 세 가지고, 셋 다 여기서 테스트한다:
//   1. 이 connector 에 쓸 수 있는 인증 방식 목록 만들기 (수용 provider ∩ 등록 provider)
//   2. begin → continue → connect 순서로 IPC 호출하기 (api 를 주입받아 더블로 대체 가능)
//   3. 실패 사유를 사용자가 읽을 수 있는 종류로 분류하기
//
// 서버 주소는 **코드 레벨**에서 오므로 입력 필드가 없다 — connector 의 origin 을 표시만 한다
// (사용자 결정 2026-08-03).

import type {
  AuthFieldSpec,
  AuthProviderInfo,
  AuthStepInfo,
  AuthTarget,
  PluginConnectorInfo
} from '../../../../../shared/ipc'

export interface ConnectOption {
  providerId: string
  label: string
  // 'personal_access_token' | 'basic' 등 — 아이콘·설명 분기에 쓴다.
  mechanism: string
}

export interface ConnectOptions {
  // 이 connector 로 연결 가능한 인증 방식. 비어 있으면 연결 버튼을 그리지 않는다.
  options: ConnectOption[]
  // 비어 있을 때의 사유. 있으면 사유를 그대로 보여준다.
  unavailableReason: 'no_matching_provider' | null
}

// connector 가 수용한다고 **선언한** provider 와 실제 **등록된** provider 의 교집합만 쓸 수 있다.
// 선언만 보고 버튼을 그리면 누르는 순간 등록되지 않은 provider 로 begin 이 실패한다.
export function buildConnectOptions(
  connector: PluginConnectorInfo,
  providers: readonly AuthProviderInfo[]
): ConnectOptions {
  const byId = new Map(providers.map((provider) => [provider.id, provider]))
  const options = connector.acceptedAuthProviders.flatMap((id): ConnectOption[] => {
    const provider = byId.get(id)
    // connector target 을 지원하지 않는 provider 는 서비스 연결에 쓸 수 없다.
    if (!provider || !provider.targets.includes('connector')) return []
    return [{ providerId: provider.id, label: provider.label, mechanism: provider.mechanisms[0] }]
  })
  return {
    options,
    unavailableReason: options.length === 0 ? 'no_matching_provider' : null
  }
}

// 서버 주소는 표시값이지 입력값이 아니다. 모달이 이 값을 읽기 전용으로 그린다.
export function connectorOriginDisplay(connector: PluginConnectorInfo): string {
  return connector.origin
}

export type ConnectFailure =
  'invalid_credentials' | 'unreachable' | 'already_connected' | 'cancelled' | 'unknown'

// `PluginHost.connect`·`AuthBroker` 는 실패를 문자열 메시지로 던진다(IPC reject). 사용자에게
// 다른 안내를 해야 하는 종류만 갈라낸다 — 자격증명은 다시 입력하면 되지만, 도달 불가는
// 주소가 코드 레벨이라 사용자가 고칠 수 없어 관리자 문의로 안내해야 한다.
export function classifyConnectFailure(error: unknown): ConnectFailure {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (/already connected/i.test(message)) return 'already_connected'
  if (/자격증명|invalid_credentials|unauthenticated/i.test(message)) return 'invalid_credentials'
  if (/연결하지 못했|unreachable|not ready/i.test(message)) return 'unreachable'
  if (/cancel/i.test(message)) return 'cancelled'
  return 'unknown'
}

// 모달이 쓰는 IPC 표면만 좁게 선언한다 — 테스트가 더블을 넣을 수 있고, 이 파일이 window 에
// 의존하지 않는다.
export interface ConnectApi {
  begin(providerId: string, target: AuthTarget): Promise<AuthStepInfo>
  continueAuth(transactionId: string, input: Record<string, string>): Promise<AuthStepInfo>
  connect(connectorId: string, bindingId: string): Promise<void>
}

export interface BeginResult {
  kind: 'collect' | 'done' | 'failed'
  transactionId?: string
  fields?: AuthFieldSpec[]
  bindingId?: string
  message?: string
}

export function newConnectionId(): string {
  return globalThis.crypto.randomUUID()
}

export function connectorTarget(connectorId: string, connectionId: string): AuthTarget {
  return { kind: 'connector', connectorId, connectionId }
}

// 1단계 — 인증 방식을 고르면 필드 선언을 받아온다. 브라우저 플로우처럼 필드가 없는 provider 도
// 있으므로 `collect` 가 아니어도 정상이다.
export async function beginConnect(
  api: ConnectApi,
  providerId: string,
  connectorId: string,
  connectionId: string
): Promise<BeginResult> {
  return toBeginResult(await api.begin(providerId, connectorTarget(connectorId, connectionId)))
}

// 2단계 — 자격증명을 넣어 binding 을 만들고, 그 binding 으로 connector 를 연결한다.
// **두 호출이 한 단위다** — binding 만 만들고 connect 를 안 하면 도구가 노출되지 않는다.
export async function completeConnect(
  api: ConnectApi,
  connectorId: string,
  transactionId: string,
  input: Record<string, string>
): Promise<{ ok: true } | { ok: false; failure: ConnectFailure; message?: string }> {
  const step = await api.continueAuth(transactionId, input)
  if (step.kind === 'failed') {
    return {
      ok: false,
      failure: 'invalid_credentials',
      ...(step.message !== undefined ? { message: step.message } : {})
    }
  }
  if (step.kind !== 'done') {
    // collect 가 다시 오는 다단계 provider — 이번 범위(PAT·ID/비밀번호)에는 없다.
    return { ok: false, failure: 'unknown' }
  }
  try {
    await api.connect(connectorId, step.binding.id)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      failure: classifyConnectFailure(error),
      ...(error instanceof Error ? { message: error.message } : {})
    }
  }
}

function toBeginResult(step: AuthStepInfo): BeginResult {
  if (step.kind === 'collect') {
    return { kind: 'collect', transactionId: step.transactionId, fields: step.fields }
  }
  if (step.kind === 'done') return { kind: 'done', bindingId: step.binding.id }
  if (step.kind === 'failed') {
    return { kind: 'failed', ...(step.message !== undefined ? { message: step.message } : {}) }
  }
  // browser/device_code 는 이번 범위의 두 provider 가 쓰지 않는다. 조용히 성공으로 넘기지 않고
  // 실패로 표시해 사용자가 막힌 것을 안다.
  return { kind: 'failed' }
}
