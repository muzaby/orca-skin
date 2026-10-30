import type { ProviderInfo } from '../../../../../../shared/ipc'
import { canManageAuth } from '../../lib/providerRows'

export type ProviderAuthActionKind = 'none' | 'authenticate' | 'dropdown' | 'connect'

export const providerAuthMenuItems = [
  { kind: 'reauth', danger: false },
  { kind: 'revoke', danger: true }
] as const

export function providerAuthActionKind(provider: ProviderInfo): ProviderAuthActionKind {
  if (provider.authScheme === 'login-free') return provider.connection ? 'connect' : 'none'
  return canManageAuth(provider) ? 'dropdown' : 'authenticate'
}

// 로그인 프리 연결 버튼 라벨(0291) — 한 번도 연결하지 않았으면 `연결`, 그 밖은 `다시 연결`.
// 확인 중에는 같은 라벨에 busy 를 건다.
export function connectActionLabel(provider: ProviderInfo): 'connect' | 'reconnect' {
  return provider.connection?.state === 'idle' ? 'connect' : 'reconnect'
}
