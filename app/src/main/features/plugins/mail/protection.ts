export const PROTECTION_RATIO = 0.5
export const PROTECTION_MIN_SAMPLE = 20
export const CONFIRM_OBSERVATIONS = 2

export interface ProtectionState {
  readonly kind: 'none' | 'suspected'
  readonly firstObservedAt?: number
  readonly observations?: number
  readonly fingerprint?: string
}

export interface ProtectionDecision {
  readonly ingest: boolean
  readonly state: ProtectionState
  readonly protection: boolean
}

export function decideProtection(input: {
  readonly retainedRatio: number
  readonly activeLedgerCount: number
  readonly now: number
  readonly remoteFingerprint: string
  readonly previous: ProtectionState
}): ProtectionDecision {
  const suspect =
    input.activeLedgerCount >= PROTECTION_MIN_SAMPLE && input.retainedRatio < PROTECTION_RATIO
  if (!suspect) {
    return { ingest: true, protection: false, state: { kind: 'none' } }
  }
  if (input.previous.kind !== 'suspected') {
    return {
      ingest: false,
      protection: true,
      state: {
        kind: 'suspected',
        firstObservedAt: input.now,
        observations: 1,
        fingerprint: input.remoteFingerprint
      }
    }
  }
  const observations =
    input.previous.fingerprint === input.remoteFingerprint
      ? (input.previous.observations ?? 0) + 1
      : 1
  if (observations >= CONFIRM_OBSERVATIONS) {
    return { ingest: true, protection: false, state: { kind: 'none' } }
  }
  return {
    ingest: false,
    protection: true,
    state: {
      kind: 'suspected',
      firstObservedAt: input.previous.firstObservedAt ?? input.now,
      observations,
      fingerprint: input.remoteFingerprint
    }
  }
}
