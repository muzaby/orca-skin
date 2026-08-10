// Provider 플랫폼 IPC (0181 — 구 `handlers/auth.ts` 7채널 + `handlers/plugins.ts` 4채널 대체).
//
// `RouterContext` 가 아니라 `ProviderPlatform` 을 직접 받는다 — 창이 `Bootstrap.start()` 완료
// 전에 열리므로(0109), 게이트 판정을 위한 `list`/`state`/`login` 은 부팅 초기에 등록되어야
// renderer 의 첫 invoke 가 성립한다. **게이트 판정에 DB 가 필요 없다**(grant 는 파일+vault).
//
// 응답 DTO 에 raw secret 이 없다 — 상태·만료·표시용 principal 만 나간다.

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
import type { ProviderPlatform } from '../../features/providers/platform'

export function registerProviderHandlers(platform: ProviderPlatform): void {
  handlePlain<ProviderInfo[]>(CHANNELS.providerList, () => platform.list())
  // 게이트 판정용 초기 스냅샷. 같은 채널로 이후 변화가 push 되므로 renderer 는 한 번 invoke 한
  // 뒤 구독만 유지한다(구 auth 의 status/stateEvent 2채널 동기화 버그 회피).
  handlePlain<ProviderPlatformState>(CHANNELS.providerState, () => platform.state())

  // 쓰기·전이류는 'reject' — 무효 페이로드는 프로그래머 오류로 표면화한다(0012 정책).
  handle(
    CHANNELS.providerLogin,
    ProviderLoginRequestSchema,
    'reject',
    (req): Promise<ProviderStepInfo> => platform.login(req.providerId, req.authKind, req.input)
  )
  handle(
    CHANNELS.providerContinue,
    ProviderContinueRequestSchema,
    'reject',
    (req): Promise<ProviderStepInfo> => platform.continue(req.providerId, req.input)
  )
  handle(
    CHANNELS.providerReauth,
    ProviderReauthRequestSchema,
    'reject',
    (req): Promise<ProviderStepInfo> => platform.reauth(req.providerId, req.authKind)
  )
  handle(CHANNELS.providerRevoke, ProviderRevokeRequestSchema, 'reject', (req): void => {
    platform.revoke(req.providerId)
  })
}
