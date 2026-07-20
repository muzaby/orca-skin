// SSO 게이트 IPC (0130). RouterContext 가 아니라 SsoService 를 직접 받는다 — 창이
// Bootstrap.start() 완료 전에 열리므로(0109) status/login 은 부팅 초기에 등록되어야
// renderer 게이트의 첫 invoke 가 성립한다.

import { CHANNELS, SsoLoginRequestSchema, type SsoState } from '../../../shared/protocol'
import { handle, handlePlain } from '../../infra/ipc/handle'
import type { SsoService } from '../../features/sso/service'

export function registerSsoHandlers(sso: SsoService): void {
  handlePlain<SsoState>(CHANNELS.ssoStatus, () => sso.status())
  handle(CHANNELS.ssoLogin, SsoLoginRequestSchema, 'reject', (req) => sso.login(req.input))
}
