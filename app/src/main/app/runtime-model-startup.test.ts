import { describe, expect, it, vi } from 'vitest'
import type { AgentEnvironment, ProviderGateState } from '../../shared/ipc'
import type { AuthChange, AuthDefinition, AuthRuntime, BoundAuth } from '../contracts/auth'
import { createVault } from '../infra/vault'
import { createMemoryGrantPersistence } from '../features/auth/store'
import { createAuthRuntime } from '../features/auth/runtime'
import { createGate } from '../features/gate'
import type { AuthResult } from '../features/auth/login'
import {
  affectedRuntimeModelAuthIds,
  createRuntimeModelAuthChangeHandler,
  createRuntimeModelAuthInvalidator,
  createRuntimeModelAuthResume,
  createRuntimeModelReconcileSnapshot,
  createRuntimeModelReconcileVerified,
  createRuntimeModelSnapshotReader,
  invalidateRuntimeModelsForAuth,
  startRuntimeModelCatalogAfterDeploy
} from './runtime-model-startup'

describe('runtime model startup', () => {
  it('finishes every deploy invalidation before catalog attach and Auth resume', async () => {
    const order: string[] = []
    const catalog = {
      list: () => [],
      isReadOnly: () => true,
      merge: (settings: AgentEnvironment[]) => settings,
      invalidate: vi.fn(async () => {
        order.push('catalog-invalidate')
      }),
      reconcile: vi.fn(async () => undefined)
    }
    await startRuntimeModelCatalogAfterDeploy({
      invalidateSettings: () => order.push('settings-invalidate'),
      invalidateRuntime: () => order.push('runtime-invalidate'),
      catalog,
      bridge: {
        onSnapshot: vi.fn(async () => undefined),
        attach: vi.fn(async () => {
          order.push('attach')
        })
      },
      resumeAuth: () => order.push('resume')
    })

    expect(order).toEqual([
      'settings-invalidate',
      'runtime-invalidate',
      'catalog-invalidate',
      'attach',
      'resume'
    ])
  })

  it('waits for catalog replay to settle before attaching the bridge', async () => {
    let release!: () => void
    const order: string[] = []
    const pending = startRuntimeModelCatalogAfterDeploy({
      invalidateSettings: vi.fn(),
      invalidateRuntime: vi.fn(),
      catalog: {
        list: () => [],
        isReadOnly: () => true,
        merge: (settings: AgentEnvironment[]) => settings,
        invalidate: () =>
          new Promise<void>((resolve) => {
            release = resolve
          }),
        reconcile: vi.fn(async () => undefined)
      },
      bridge: {
        onSnapshot: vi.fn(async () => undefined),
        attach: vi.fn(async () => {
          order.push('attach')
        })
      },
      resumeAuth: () => order.push('resume')
    })

    await Promise.resolve()
    expect(order).toEqual([])
    release()
    await pending
    expect(order).toEqual(['attach', 'resume'])
  })

  it('reads the live store snapshot on every call rather than a captured one', () => {
    const snapshots: Record<string, { authId: string; revision: number }> = {
      gate: { authId: 'gate', revision: 1 }
    }
    const reader = createRuntimeModelSnapshotReader({
      bind: (authId) => ({ snapshot: () => snapshots[authId] }) as never
    })

    expect(reader('gate')).toMatchObject({ revision: 1 })
    snapshots['gate'] = { authId: 'gate', revision: 2 }
    expect(reader('gate')).toMatchObject({ revision: 2 })
  })

  it('forwards a verified authId to the catalog bridge with its current snapshot', () => {
    const onSnapshot = vi.fn(async () => undefined)
    let revision = 1
    const notify = createRuntimeModelReconcileVerified({
      bridge: { onSnapshot },
      snapshotOf: (authId) => ({ authId, revision }) as never
    })

    notify('wiki')
    revision = 2
    notify('wiki')

    expect(onSnapshot).toHaveBeenCalledTimes(2)
    expect(onSnapshot).toHaveBeenNthCalledWith(1, 'wiki', { authId: 'wiki', revision: 1 })
    expect(onSnapshot).toHaveBeenNthCalledWith(2, 'wiki', { authId: 'wiki', revision: 2 })
  })

  it('forwards an already-held snapshot to the bridge without re-reading the store', () => {
    const onSnapshot = vi.fn(async () => undefined)
    const forward = createRuntimeModelReconcileSnapshot({ onSnapshot })

    forward('wiki', { authId: 'wiki', revision: 7 } as never)

    expect(onSnapshot).toHaveBeenCalledExactlyOnceWith('wiki', { authId: 'wiki', revision: 7 })
  })

  it('routes one Auth snapshot change to broadcast, plugin sync, invalidation, and reconcile', () => {
    const log: string[] = []
    const handle = createRuntimeModelAuthChangeHandler({
      recordGateLogin: (authId, revision) => log.push(`gate:${authId}:${revision}`),
      pushConnectionState: () => log.push('push'),
      syncPlugins: (authId) => log.push(`sync:${authId}`),
      invalidateForAuth: (authId) => log.push(`invalidate:${authId}`),
      reconcileSnapshot: (authId) => log.push(`reconcile:${authId}`)
    })

    handle({
      kind: 'snapshot',
      authId: 'wiki',
      credentialChanged: true,
      cause: 'credential-committed',
      snapshot: { authId: 'wiki', credentialRevision: 7 }
    } as never)

    expect(log).toEqual(['gate:wiki:7', 'push', 'sync:wiki', 'invalidate:wiki', 'reconcile:wiki'])
  })

  it('reconciles a snapshot change that did not swap credentials, and stops at step changes', () => {
    const log: string[] = []
    const handle = createRuntimeModelAuthChangeHandler({
      recordGateLogin: (authId, revision) => log.push(`gate:${authId}:${revision}`),
      pushConnectionState: () => log.push('push'),
      syncPlugins: (authId) => log.push(`sync:${authId}`),
      invalidateForAuth: (authId) => log.push(`invalidate:${authId}`),
      reconcileSnapshot: (authId) => log.push(`reconcile:${authId}`)
    })

    // `verified` 는 `credentialChanged:false` 인데도 재조정에 도달해야 한다 (0202 D-008).
    handle({
      kind: 'snapshot',
      authId: 'gate',
      credentialChanged: false,
      snapshot: { authId: 'gate' }
    } as never)
    handle({ kind: 'step', authId: 'gate' } as never)

    expect(log).toEqual(['push', 'reconcile:gate', 'push'])
  })

  it('returns every Auth owner of invalidated canonical contribution keys', () => {
    expect(
      affectedRuntimeModelAuthIds(
        [' ORCA-SHARED '],
        [
          { authId: 'a', key: 'orca-shared', harnessId: 'orca', modelProviderId: 'a' },
          { authId: 'b', key: 'ORCA-SHARED', harnessId: 'orca', modelProviderId: 'b' },
          { authId: 'c', key: 'orca-other', harnessId: 'orca', modelProviderId: 'c' }
        ]
      )
    ).toEqual(['a', 'b'])
  })

  it('reconciles every Auth owner after invalidating shared contribution keys', () => {
    const invalidated: string[] = []
    const reconciled: string[] = []
    invalidateRuntimeModelsForAuth({
      keys: [' ORCA-SHARED '],
      contributions: [
        { authId: 'a', key: 'orca-shared', harnessId: 'orca', modelProviderId: 'a' },
        { authId: 'b', key: 'ORCA-SHARED', harnessId: 'orca', modelProviderId: 'b' }
      ],
      invalidate: (key) => invalidated.push(key),
      snapshotOf: (authId) => ({ authId }) as never,
      reconcile: (authId) => reconciled.push(authId)
    })

    expect(invalidated).toEqual([' ORCA-SHARED '])
    expect(reconciled).toEqual(['a', 'b'])
  })

  it('derives invalidated keys from the full deployment declarations', () => {
    const invalidated: string[] = []
    const reconciled: string[] = []
    const invalidateForAuth = createRuntimeModelAuthInvalidator({
      invalidatedKeys: { a: ['runtime-env'] },
      contributions: [
        { authId: 'a', key: 'shared', harnessId: 'orca', modelProviderId: 'a' },
        { authId: 'b', key: 'SHARED', harnessId: 'orca', modelProviderId: 'b' }
      ],
      invalidate: (key) => invalidated.push(key),
      snapshotOf: (authId) => ({ authId }) as never,
      reconcile: (authId) => reconciled.push(authId)
    })

    invalidateForAuth('a')

    expect(invalidated).toEqual(['runtime-env', 'shared'])
    expect(reconciled).toEqual(['a', 'b'])
  })

  it('installs both Auth listeners before running the real resume callback', () => {
    const order: string[] = []
    const listeners: Array<(change: never) => void> = []
    const resume = createRuntimeModelAuthResume({
      auth: {
        subscribe: (listener) => {
          order.push('subscribe')
          listeners.push(listener as never)
          return () => undefined
        }
      },
      onChange: () => order.push('change'),
      onGateChange: (authId) => order.push(`gate:${authId}`),
      run: () => order.push('run')
    })

    resume()
    listeners[0]?.({ kind: 'snapshot', authId: 'gate' } as never)
    listeners[1]?.({ kind: 'snapshot', authId: 'gate' } as never)

    expect(order).toEqual(['subscribe', 'subscribe', 'run', 'change', 'gate:gate'])
  })
})

describe('daily gate with real Auth commits', () => {
  function harness(): {
    runtime: AuthRuntime
    bound: BoundAuth
    gate: ReturnType<typeof createGate>
    log: string[]
    pushed: ProviderGateState[]
    changes: AuthChange[]
    setProbe(value: boolean): void
    setLoginMode(value: 'token' | 'cancel' | 'code'): void
    setRefreshFails(value: boolean): void
    deferLogin(): (result: AuthResult) => void
    clear(): void
  } {
    const secrets = new Map<string, string>()
    let probeOk = true
    let loginMode: 'token' | 'cancel' | 'code' = 'token'
    let refreshFails = false
    let deferredLogin: Promise<AuthResult> | undefined
    const definition: AuthDefinition = {
      id: 'gate',
      label: 'Gate',
      origin: 'https://gate.example.corp',
      probe: { onResume: true, execute: async () => ({ ok: probeOk, rejected: !probeOk }) },
      methods: [
        {
          kind: 'oauth',
          label: 'OAuth',
          present: { location: 'header', name: 'Authorization', scheme: 'bearer' },
          authorize: async () => {
            throw new Error('OAuth executor owns authorize')
          },
          refresh: async () => {
            if (refreshFails) throw new Error('refresh failed')
            return { token: 'refreshed', refreshToken: 'next-refresh' }
          }
        }
      ]
    }
    const { runtime } = createAuthRuntime({
      definitions: [definition],
      persistence: createMemoryGrantPersistence(),
      vault: createVault({
        get: (key) => secrets.get(key),
        set: (key, value) => void secrets.set(key, value),
        delete: (key) => void secrets.delete(key)
      }),
      fetchImpl: (async () => {
        throw new Error('executable probe must not fetch')
      }) as typeof fetch,
      clock: () => 1000,
      oauth: {
        begin: async () => {
          if (deferredLogin) return deferredLogin
          if (loginMode === 'cancel')
            return { kind: 'failed', reason: 'cancelled', message: 'cancelled' }
          if (loginMode === 'code')
            return { kind: 'code-required', url: 'https://gate.example.corp/login' }
          return { kind: 'token', token: { token: 'login', refreshToken: 'refresh' } }
        },
        complete: async () => ({
          kind: 'token',
          token: { token: 'complete', refreshToken: 'refresh' }
        })
      }
    })
    const bound = runtime.bind('gate')
    const gate = createGate({ members: [bound], bypass: () => false })
    const log: string[] = []
    const pushed: ReturnType<typeof gate.state>[] = []
    const changes: AuthChange[] = []
    const handle = createRuntimeModelAuthChangeHandler({
      recordGateLogin: (authId, revision) => {
        log.push('gate')
        gate.noteLoginCommit(authId, revision)
      },
      pushConnectionState: () => {
        log.push('push')
        pushed.push(gate.state())
      },
      syncPlugins: () => log.push('sync'),
      invalidateForAuth: () => log.push('invalidate'),
      reconcileSnapshot: () => log.push('reconcile')
    })
    runtime.subscribe((change) => {
      changes.push(change)
      handle(change)
    })
    return {
      runtime,
      bound,
      gate,
      log,
      pushed,
      changes,
      setProbe: (value: boolean) => {
        probeOk = value
      },
      setLoginMode: (value: typeof loginMode) => {
        loginMode = value
      },
      setRefreshFails: (value: boolean) => {
        refreshFails = value
      },
      deferLogin: () => {
        let resolve!: (result: AuthResult) => void
        deferredLogin = new Promise<AuthResult>((done) => {
          resolve = done
        })
        return resolve
      },
      clear: () => {
        log.length = 0
        pushed.length = 0
        changes.length = 0
      }
    }
  }

  it('refresh changes credentials and invalidates consumers while only login clears the gate before push', async () => {
    const h = harness()
    await h.runtime.login('gate', 'oauth')
    expect(h.gate.state().passed).toBe(true)
    h.gate.lapseDay()
    const boundaryRevision = h.bound.snapshot().credentialRevision
    h.clear()
    await expect(h.runtime.refresh('gate')).resolves.toBe('refreshed')
    expect(h.bound.snapshot().credentialRevision).toBeGreaterThan(boundaryRevision)
    expect(h.changes.filter((change) => change.kind === 'snapshot')).toEqual([
      expect.objectContaining({ cause: 'credential-refreshed', credentialChanged: true })
    ])
    expect(h.log).toEqual(['push', 'sync', 'invalidate', 'reconcile', 'push'])
    expect(h.pushed.every((state) => !state.passed && state.dailyRelogin.includes('gate'))).toBe(
      true
    )
    h.clear()
    await h.runtime.login('gate', 'oauth')
    expect(h.log).toEqual(['gate', 'push', 'sync', 'invalidate', 'reconcile', 'push'])
    expect(h.pushed[0]).toEqual({ required: true, passed: true, bypassed: false, dailyRelogin: [] })
    expect(h.gate.state().passed).toBe(true)
  })

  it('failed refresh, cancelled login, and rejected probe never provide a login commit', async () => {
    const h = harness()
    await h.runtime.login('gate', 'oauth')
    h.gate.lapseDay()
    const revision = h.bound.snapshot().credentialRevision
    h.clear()
    h.setRefreshFails(true)
    await expect(h.runtime.refresh('gate')).resolves.toBe('failed')
    h.setLoginMode('cancel')
    await h.runtime.login('gate', 'oauth')
    h.setLoginMode('token')
    h.setProbe(false)
    await h.runtime.login('gate', 'oauth')
    expect(h.log).not.toContain('gate')
    expect(h.changes.filter((change) => change.kind === 'snapshot')).toEqual([])
    expect(h.bound.snapshot().credentialRevision).toBe(revision)
    expect(h.gate.state().dailyRelogin).toEqual(['gate'])
  })

  it('reauth and continuation both emit committed and satisfy a new boundary', async () => {
    const h = harness()
    await h.runtime.login('gate', 'oauth')
    h.gate.lapseDay()
    h.clear()
    await h.runtime.reauth('gate', 'oauth')
    expect(h.changes.filter((change) => change.kind === 'snapshot')).toEqual([
      expect.objectContaining({ cause: 'credential-committed' })
    ])
    expect(h.gate.state().passed).toBe(true)
    h.gate.lapseDay()
    h.setLoginMode('code')
    h.clear()
    await h.runtime.login('gate', 'oauth')
    expect(h.log).not.toContain('gate')
    expect(h.gate.state().passed).toBe(false)
    await h.runtime.continue('gate', { code: 'test-code' })
    expect(h.changes.filter((change) => change.kind === 'snapshot')).toEqual([
      expect.objectContaining({ cause: 'credential-committed' })
    ])
    expect(h.gate.state().passed).toBe(true)
  })

  it('a superseded login result emits no successful commit evidence', async () => {
    const h = harness()
    await h.runtime.login('gate', 'oauth')
    h.gate.lapseDay()
    h.clear()
    const resolve = h.deferLogin()
    const pending = h.runtime.login('gate', 'oauth')
    await h.runtime.revoke('gate')
    resolve({ kind: 'token', token: { token: 'late-login', refreshToken: 'late-refresh' } })
    await pending
    expect(h.log).not.toContain('gate')
    expect(
      h.changes.filter(
        (change) => change.kind === 'snapshot' && change.cause === 'credential-committed'
      )
    ).toEqual([])
    expect(h.gate.state().passed).toBe(false)
    expect(h.gate.state().dailyRelogin).toEqual(['gate'])
  })
})
