export type MailSyncMode = 'incremental' | 'full'

export function normalizeSyncMode(value: unknown): MailSyncMode {
  return value === 'full' ? 'full' : 'incremental'
}

export function syncPlan(mode: MailSyncMode): { bypassFreshness: boolean; refetchKnown: boolean } {
  return { bypassFreshness: mode === 'full', refetchKnown: mode === 'full' }
}

export function joinsRunningSync(running: MailSyncMode, requested: MailSyncMode): boolean {
  return running === 'full' || requested === 'incremental'
}
