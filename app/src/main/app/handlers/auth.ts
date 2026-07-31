// 인증 플랫폼 IPC (0157 — 구 handlers/sso.ts 대체).
//
// RouterContext 가 아니라 AuthBroker 를 직접 받는다 — 창이 Bootstrap.start() 완료 전에 열리므로
// (0109) status/begin/continue 는 부팅 초기에 등록되어야 renderer 게이트의 첫 invoke 가 성립한다.
//
// 응답 DTO 에는 raw secret 이 없다. binding 은 handleId 만 갖고(AuthArtifactRef), provider 목록은
// allowedOrigins 조차 내보내지 않는다.

import {
  AuthBeginRequestSchema,
  AuthContinueRequestSchema,
  AuthBindingRequestSchema,
  AuthLogoutRequestSchema,
  CHANNELS,
  type AuthBindingInfo,
  type AuthLogoutOutcome,
  type AuthPlatformState,
  type AuthProviderInfo,
  type AuthRefreshOutcome,
  type AuthStepInfo
} from '../../../shared/protocol'
import { handle, handlePlain } from '../../infra/ipc/handle'
import type { AuthBroker } from '../../features/auth-platform/broker'

export function registerAuthHandlers(broker: AuthBroker): void {
  handlePlain<AuthPlatformState>(CHANNELS.authStatus, () => broker.status())
  handlePlain<AuthProviderInfo[]>(CHANNELS.authProviders, () => broker.status().providers)
  handlePlain<AuthBindingInfo[]>(CHANNELS.authBindings, () => broker.listBindings())

  // 쓰기·전이류는 'reject' — 무효 페이로드는 프로그래머 오류로 표면화한다(0012 정책).
  handle(CHANNELS.authBegin, AuthBeginRequestSchema, 'reject', (req): Promise<AuthStepInfo> =>
    broker.begin(req.providerId, req.target)
  )
  handle(CHANNELS.authContinue, AuthContinueRequestSchema, 'reject', (req): Promise<AuthStepInfo> =>
    broker.continue(req.transactionId, req.input)
  )
  handle(
    CHANNELS.authRefresh,
    AuthBindingRequestSchema,
    'reject',
    (req): Promise<AuthRefreshOutcome> => broker.refreshBinding(req.bindingId)
  )
  handle(
    CHANNELS.authLogout,
    AuthLogoutRequestSchema,
    'reject',
    (req): Promise<AuthLogoutOutcome> => broker.logout(req.bindingId, req.cascade)
  )
}
