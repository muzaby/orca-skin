import { describe, expect, it } from 'vitest'
import type { ProviderInfo } from '../../../../../shared/ipc'
import { currentGateProvider, showsDailyRelogin } from './gateStep'

function provider(id: string, status: ProviderInfo['status'] = 'valid'): ProviderInfo {
  return {
    id,
    label: id,
    kind: 'gate',
    authScheme: 'login-required',
    origin: 'https://portal.example.corp',
    auth: [{ kind: 'browser-session', label: 'SSO', fields: [] }],
    status,
    activeAuthKind: 'browser-session',
    principal: null,
    expiresAt: null,
    tools: []
  }
}

describe('currentGateProvider', () => {
  it('selects the second valid member after the first daily login is committed', () => {
    const providers = [provider('first'), provider('second')]
    expect(currentGateProvider(providers, ['first', 'second'])).toBe(providers[0])
    expect(currentGateProvider(providers, ['second'])).toBe(providers[1])
  })
  it('preserves member order across daily and non-valid members', () => {
    const providers = [provider('first'), provider('second', 'expired')]
    expect(currentGateProvider(providers, ['first'])).toBe(providers[0])
    expect(currentGateProvider(providers, [])).toBe(providers[1])
  })
  it('uses the existing fallback and handles an empty declaration', () => {
    const providers = [provider('first'), provider('second')]
    expect(currentGateProvider(providers, [])).toBe(providers[0])
    expect(currentGateProvider([], ['missing'])).toBeUndefined()
  })
})

describe('showsDailyRelogin', () => {
  it('shows the reason for a valid current daily member', () => {
    expect(showsDailyRelogin(provider('first'), ['first'])).toBe(true)
  })
  it.each(['none', 'expired'] as const)('hides the daily reason for status %s', (status) => {
    expect(showsDailyRelogin(provider('first', status), ['first'])).toBe(false)
  })
  it('hides the reason for a member outside the daily list and for no current member', () => {
    expect(showsDailyRelogin(provider('first'), ['second'])).toBe(false)
    expect(showsDailyRelogin(undefined, ['first'])).toBe(false)
  })
})
