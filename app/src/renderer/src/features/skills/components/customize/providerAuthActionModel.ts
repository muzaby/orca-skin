import type { ProviderInfo } from '../../../../../../shared/ipc'
import { canManageAuth } from '../../lib/providerRows'

export type ProviderAuthActionKind = 'none' | 'authenticate' | 'dropdown'

export const providerAuthMenuItems = [
  { kind: 'reauth', danger: false },
  { kind: 'revoke', danger: true }
] as const

export function providerAuthActionKind(provider: ProviderInfo): ProviderAuthActionKind {
  if (provider.authScheme === 'login-free') return 'none'
  return canManageAuth(provider) ? 'dropdown' : 'authenticate'
}
