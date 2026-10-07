import type { ProviderInfo } from '../../../../../shared/ipc'

export function currentGateProvider(
  providers: readonly ProviderInfo[],
  dailyRelogin: readonly string[]
): ProviderInfo | undefined {
  return (
    providers.find(
      (provider) => provider.status !== 'valid' || dailyRelogin.includes(provider.id)
    ) ?? providers[0]
  )
}

export function showsDailyRelogin(
  current: ProviderInfo | undefined,
  dailyRelogin: readonly string[]
): boolean {
  return !!current && current.status === 'valid' && dailyRelogin.includes(current.id)
}
