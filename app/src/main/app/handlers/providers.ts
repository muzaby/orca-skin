// 연결(Auth) IPC (0181 → 0188).
//
// `RouterContext` 가 아니라 `AuthRuntime`·`Gate`·view source 를 직접 받는다 — 창이
// `Bootstrap.start()` 완료 전에 열리므로(0109), 게이트 판정을 위한 `list`/`state`/`login` 은
// 부팅 초기에 등록되어야 renderer 의 첫 invoke 가 성립한다. **게이트 판정에 DB 가 필요 없다**
// (grant 는 파일+vault).
//
// 응답 DTO 에 raw secret 이 없다 — 상태·만료·표시용 principal 만 나간다.
//
// **채널·DTO 이름은 `orca:provider:*` 그대로다** (0188 D-030) — 별도 UI migration 전까지
// compatibility 계약이다. 내부 소유자만 바뀌었다.

import {
  CHANNELS,
  ProviderContinueRequestSchema,
  ProviderLoginRequestSchema,
  ProviderReauthRequestSchema,
  ProviderRevokeRequestSchema,
  type ProviderInfo,
  type ProviderPlatformState,
  type ProviderStepInfo
} from '../../../shared/protocol'
import { handle, handlePlain } from '../../infra/ipc/handle'
import type { AuthRuntime } from '../../contracts/auth'
import type { Gate } from '../../features/gate'
import { connectionList, connectionState, type ConnectionViewSource } from '../connection-views'

export interface ConnectionHandlerDeps {
  auth: AuthRuntime
  gate: Gate
  connections: readonly ConnectionViewSource[]
}

export function registerConnectionHandlers(deps: ConnectionHandlerDeps): void {
  const { auth, gate, connections } = deps

  handlePlain<ProviderInfo[]>(CHANNELS.providerList, () => connectionList(auth, connections))
  // 게이트 판정용 초기 스냅샷. 같은 채널로 이후 변화가 push 되므로 renderer 는 한 번 invoke 한
  // 뒤 구독만 유지한다(구 auth 의 status/stateEvent 2채널 동기화 버그 회피).
  handlePlain<ProviderPlatformState>(CHANNELS.providerState, () =>
    connectionState(auth, gate, connections)
  )

  // 쓰기·전이류는 'reject' — 무효 페이로드는 프로그래머 오류로 표면화한다(0012 정책).
  //
  // **연결 버튼은 인증 행위만 한다** (0188): Plugin fetch·Usage refresh·Harness config resolve 를
  // 여기서 부르지 않는다. 필요한 feature 는 Auth change 를 무효화 신호로만 쓰고 자기 시점에
  // lazy resolve 한다.
  handle(
    CHANNELS.providerLogin,
    ProviderLoginRequestSchema,
    'reject',
    (req): Promise<ProviderStepInfo> => auth.login(req.providerId, req.authKind, req.input)
  )
  handle(
    CHANNELS.providerContinue,
    ProviderContinueRequestSchema,
    'reject',
    (req): Promise<ProviderStepInfo> => auth.continue(req.providerId, req.input)
  )
  handle(
    CHANNELS.providerReauth,
    ProviderReauthRequestSchema,
    'reject',
    (req): Promise<ProviderStepInfo> => auth.reauth(req.providerId, req.authKind)
  )
  handle(CHANNELS.providerRevoke, ProviderRevokeRequestSchema, 'reject', (req): void => {
    auth.revoke(req.providerId)
  })
}
