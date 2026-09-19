// 프로토콜 중립이다 (0237 D-056) — POP3 UIDL 이든 IMAP UID 든 "원격이 준 안정 식별자" 다.
export interface LedgerEntry {
  readonly remoteUid: string
  readonly state?: 'active' | 'missing'
}

export interface ReconcileResult {
  readonly fresh: readonly string[]
  readonly known: readonly string[]
  readonly missing: readonly string[]
  readonly retainedRatio: number
  readonly activeLedgerCount: number
}

export function reconcileRemoteUids(
  local: readonly LedgerEntry[],
  remote: readonly string[]
): ReconcileResult {
  const localActive = local.filter((entry) => entry.state !== 'missing')
  const remoteSet = new Set(remote)
  const localSet = new Set(localActive.map((entry) => entry.remoteUid))
  return {
    fresh: remote.filter((remoteUid) => !localSet.has(remoteUid)),
    known: remote.filter((remoteUid) => localSet.has(remoteUid)),
    missing: localActive
      .filter((entry) => !remoteSet.has(entry.remoteUid))
      .map((entry) => entry.remoteUid),
    retainedRatio:
      localActive.length === 0
        ? 1
        : remote.filter((remoteUid) => localSet.has(remoteUid)).length / localActive.length,
    activeLedgerCount: localActive.length
  }
}
