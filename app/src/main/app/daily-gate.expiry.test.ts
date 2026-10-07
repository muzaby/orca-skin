import { describe, expect, it } from 'vitest'
import type { ProviderGateState } from '../../shared/ipc'
import type { AuthChange, AuthDefinition, AuthSnapshot } from '../contracts/auth'
import { createVault } from '../infra/vault'
import { createMemoryGrantPersistence } from '../features/auth/store'
import { createAuthRuntime } from '../features/auth/runtime'
import { createGate } from '../features/gate'
import { createRuntimeModelAuthChangeHandler } from './runtime-model-startup'
import { startDailyGate } from './daily-gate'

interface ExpiryObservation {
  beforeSnapshot: AuthSnapshot
  afterSnapshot: AuthSnapshot
  beforeGate: ProviderGateState
  afterGate: ProviderGateState
  broadcastCount: number
  policyPushes: number
  broadcasts: ProviderGateState[]
  expiryEvents: number
  effectiveExpiry: number
  syncCount: number
  invalidateCount: number
  persistenceWrites: number
  fetchCalls: number
  authorizeCalls: number
  log: string[]
}

async function observeNaturalExpiryAtBoundary(): Promise<ExpiryObservation> {
  let now = new Date(2026, 9, 7, 23, 59, 59).getTime()
  const midnight = new Date(2026, 9, 8).getTime()
  const secrets = new Map<string, string>()
  const vault = createVault({
    get: (key) => secrets.get(key),
    set: (key, value) => void secrets.set(key, value),
    delete: (key) => void secrets.delete(key)
  })
  vault.set('gate:token', 'seed-token', { kind: 'oauth', createdAt: now, expiresAt: midnight })
  const memoryPersistence = createMemoryGrantPersistence({
    gate: {
      kind: 'token',
      vaultKey: 'gate:token',
      authKind: 'oauth',
      createdAt: now,
      expiresAt: midnight
    }
  })
  let persistenceWrites = 0
  let fetchCalls = 0
  let authorizeCalls = 0
  const definition: AuthDefinition = {
    id: 'gate',
    label: 'Gate',
    origin: 'https://gate.example.corp',
    probe: { onResume: true, execute: async () => ({ ok: true, rejected: false }) },
    methods: [
      {
        kind: 'oauth',
        label: 'OAuth',
        present: { location: 'header', name: 'Authorization', scheme: 'bearer' },
        authorize: async () => {
          authorizeCalls++
          throw new Error('probe must not authorize')
        }
      }
    ]
  }
  const { runtime } = createAuthRuntime({
    definitions: [definition],
    persistence: {
      load: () => memoryPersistence.load(),
      save: (records) => {
        persistenceWrites++
        return memoryPersistence.save(records)
      }
    },
    vault,
    clock: () => now,
    fetchImpl: (async () => {
      fetchCalls++
      throw new Error('probe must not fetch')
    }) as typeof fetch
  })
  await runtime.resume('gate')
  const bound = runtime.bind('gate')
  const gate = createGate({ members: [bound], bypass: () => false })
  const beforeSnapshot = bound.snapshot()
  const beforeGate = gate.state()
  expect(beforeSnapshot).toMatchObject({ status: 'valid', verified: true, credentialRevision: 0 })
  expect(beforeGate.passed).toBe(true)
  persistenceWrites = 0
  const log: string[] = []
  const changes: AuthChange[] = []
  const broadcasts: ProviderGateState[] = []
  const pushConnectionState = (): void => {
    log.push('push')
    // lapseDay's snapshot publishes expiry synchronously. This first read reenters the gate
    // before lapseDay has recorded the member's daily mark.
    broadcasts.push(gate.state())
  }
  const handler = createRuntimeModelAuthChangeHandler({
    recordGateLogin: (authId, revision) => {
      log.push('gate-login')
      gate.noteLoginCommit(authId, revision)
    },
    pushConnectionState,
    syncPlugins: () => log.push('sync'),
    invalidateForAuth: () => log.push('invalidate'),
    reconcileSnapshot: () => log.push('reconcile')
  })
  const unsubscribe = runtime.subscribe((change) => {
    changes.push(change)
    if (change.kind === 'snapshot') log.push(`event:${change.cause}`)
    handler(change)
  })
  let timer: (() => void) | undefined
  let policyPushes = 0
  const daily = startDailyGate({
    gate,
    pushConnectionState: () => {
      policyPushes++
      log.push('policy-push')
      pushConnectionState()
    },
    now: () => now,
    setTimer: (callback) => {
      timer = callback
      return 1
    },
    clearTimer: () => {
      timer = undefined
    },
    subscribeWake: () => () => undefined
  })
  now = midnight
  timer!()
  const observation: ExpiryObservation = {
    beforeSnapshot,
    afterSnapshot: bound.snapshot(),
    beforeGate,
    afterGate: gate.state(),
    broadcastCount: broadcasts.length,
    policyPushes,
    broadcasts,
    expiryEvents: changes.filter(
      (change) => change.kind === 'snapshot' && change.cause === 'expired'
    ).length,
    effectiveExpiry: changes.filter(
      (change) =>
        change.kind === 'snapshot' && change.cause === 'expired' && change.credentialChanged
    ).length,
    syncCount: log.filter((entry) => entry === 'sync').length,
    invalidateCount: log.filter((entry) => entry === 'invalidate').length,
    persistenceWrites,
    fetchCalls,
    authorizeCalls,
    log
  }
  daily.dispose()
  unsubscribe()
  return observation
}

describe('daily boundary and natural Auth expiry', () => {
  it('preserves expiry settlement and reentrant broadcast while the daily policy directly pushes once', async () => {
    const observed = await observeNaturalExpiryAtBoundary()
    expect(observed).toMatchObject({
      afterSnapshot: { status: 'expired', verified: false, credentialRevision: 1 },
      afterGate: { passed: false, dailyRelogin: ['gate'] },
      broadcastCount: 2,
      policyPushes: 1,
      expiryEvents: 1,
      effectiveExpiry: 1,
      syncCount: 1,
      invalidateCount: 1,
      persistenceWrites: 1,
      fetchCalls: 0,
      authorizeCalls: 0,
      log: ['event:expired', 'push', 'sync', 'invalidate', 'reconcile', 'policy-push', 'push']
    })
    expect(
      observed.afterSnapshot.credentialRevision - observed.beforeSnapshot.credentialRevision
    ).toBe(1)
    expect(observed.broadcasts.map((state) => state.dailyRelogin)).toEqual([[], ['gate']])
  })
})
