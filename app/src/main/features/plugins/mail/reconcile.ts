export interface LedgerEntry {
  readonly uidl: string
  readonly state?: 'active' | 'missing'
}

export interface ReconcileResult {
  readonly fresh: readonly string[]
  readonly known: readonly string[]
  readonly missing: readonly string[]
  readonly retainedRatio: number
  readonly activeLedgerCount: number
}

export function reconcileUidls(
  local: readonly LedgerEntry[],
  remote: readonly string[]
): ReconcileResult {
  const localActive = local.filter((entry) => entry.state !== 'missing')
  const remoteSet = new Set(remote)
  const localSet = new Set(localActive.map((entry) => entry.uidl))
  return {
    fresh: remote.filter((uidl) => !localSet.has(uidl)),
    known: remote.filter((uidl) => localSet.has(uidl)),
    missing: localActive.filter((entry) => !remoteSet.has(entry.uidl)).map((entry) => entry.uidl),
    retainedRatio:
      localActive.length === 0
        ? 1
        : remote.filter((uidl) => localSet.has(uidl)).length / localActive.length,
    activeLedgerCount: localActive.length
  }
}
