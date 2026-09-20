import { describe, expect, it, vi } from 'vitest'
import type {
  AuthDefinition,
  AuthProbe,
  ExecutableAuthProbe,
  PluginAuth
} from '../../contracts/auth'

type ProbeResult = Awaited<ReturnType<ExecutableAuthProbe['execute']>>
import { createVault } from '../../infra/vault'
import { createMemoryGrantPersistence } from './store'
import { createAuthRuntime } from './runtime'
import { passwordSpec } from './specs/credential'

function setup(probe?: AuthProbe): {
  runtime: ReturnType<typeof createAuthRuntime>['runtime']
  rejected: ReturnType<typeof createAuthRuntime>['rejected']
  set: (key: string, value: string) => void
  fetchImpl: typeof fetch
  definition: AuthDefinition
  restore: () => ReturnType<typeof createAuthRuntime>['runtime']
} {
  const secrets = new Map<string, string>()
  const set = vi.fn((key: string, value: string) => void secrets.set(key, value))
  const fetchImpl = vi.fn<typeof fetch>(async () => new Response('ok'))
  const definition: AuthDefinition = {
    id: 'mail',
    label: 'Mail',
    origin: 'pop3s://mail.example:995',
    methods: [passwordSpec({ label: '비밀번호' })],
    ...(probe ? { probe } : {})
  }
  const persistence = createMemoryGrantPersistence()
  const vault = createVault({
    get: (key) => secrets.get(key),
    set,
    delete: (key) => void secrets.delete(key)
  })
  const create = (): ReturnType<typeof createAuthRuntime> =>
    createAuthRuntime({
      definitions: [definition],
      fetchImpl,
      persistence,
      vault
    })
  const { runtime, rejected } = create()
  return { runtime, rejected, set, fetchImpl, definition, restore: () => create().runtime }
}

describe('plugin auth scope and declaration probe', () => {
  it('non-HTTP authority is accepted and scoped values match input; HTTP request never sends', async () => {
    const execute = vi.fn(async () => ({ ok: true, rejected: false }))
    const { runtime, rejected, fetchImpl, restore } = setup({ execute })
    expect(rejected).toEqual([])
    const auth: PluginAuth = runtime.bindForPlugin('mail')
    expect(auth).toMatchObject({
      authId: 'mail',
      label: 'Mail',
      origin: 'pop3s://mail.example:995'
    })
    expect(() => runtime.bindForPlugin('missing')).toThrow()
    await expect(auth.withCredential(async () => 'no')).rejects.toThrow()
    await runtime.login('mail', 'password', { username: 'alice', password: ' p:a:ss ' })
    expect(execute).toHaveBeenCalledWith(
      { value: 'alice: p:a:ss ', authKind: 'password', principalId: 'alice' },
      expect.any(AbortSignal)
    )
    expect(await auth.withCredential(async (value) => value.value)).toBe('alice: p:a:ss ')
    await expect(auth.request({ path: '/' })).rejects.toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
    const restored = restore()
    expect(restored.bind('mail').snapshot().verified).toBe(false)
    await restored.resume('mail')
    expect(restored.bind('mail').snapshot().verified).toBe(true)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('candidate rejection and unreachable failures do not write the vault and show different messages', async () => {
    let rejected = true
    const { runtime, set } = setup({ execute: async () => ({ ok: false, rejected }) })
    const a = await runtime.login('mail', 'password', { username: 'alice', password: 'bad' })
    rejected = false
    const b = await runtime.login('mail', 'password', { username: 'alice', password: 'good' })
    expect(a).toMatchObject({
      kind: 'input-required',
      message: '자격증명이 거부되었습니다. 값을 확인해 주세요.'
    })
    expect(b).toMatchObject({
      kind: 'input-required',
      message: '서버에 닿지 못했습니다. 서버 주소와 네트워크를 확인해 주세요.'
    })
    expect(a).not.toEqual(b)
    expect(set).not.toHaveBeenCalled()
    expect(runtime.bind('mail').snapshot().status).toBe('none')
  })

  it('method probe overrides definition probe', async () => {
    const execute = vi.fn(async () => ({ ok: false, rejected: true }))
    const { runtime, definition } = setup({ execute })
    const methodExecute = vi.fn(async () => ({ ok: true, rejected: false }))
    definition.methods[0].probe = { execute: methodExecute }
    await runtime.login('mail', 'password', { username: 'alice', password: 'good' })
    expect(execute).not.toHaveBeenCalled()
    expect(methodExecute).toHaveBeenCalledTimes(1)
    expect(runtime.bind('mail').snapshot().status).toBe('valid')
  })

  it('resume keeps a restored grant when the declaration says the failure is not a rejection', async () => {
    const execute = vi.fn(async (): Promise<ProbeResult> => ({ ok: true, rejected: false }))
    const probe: AuthProbe = { execute, onResume: true }
    const { runtime, restore } = setup(probe)
    await runtime.login('mail', 'password', { username: 'alice', password: 'pw' })

    // 권한 부족·서버 점검·도달 실패 — 서버가 이 자격증명을 거부한 적이 없다.
    execute.mockResolvedValue({ ok: false, rejected: false, preserveGrant: true })
    const resumed = restore()
    await resumed.resume('mail')

    expect(execute).toHaveBeenCalledTimes(2)
    expect(resumed.bind('mail').snapshot().status).toBe('valid')
  })

  it('resume expires a restored grant on a declared rejection and on an unexplained failure', async () => {
    const outcomes: ProbeResult[] = [
      { ok: false, rejected: true },
      { ok: false, rejected: false }
    ]
    for (const outcome of outcomes) {
      const execute = vi.fn(async (): Promise<ProbeResult> => ({ ok: true, rejected: false }))
      const probe: AuthProbe = { execute, onResume: true }
      const { runtime, restore } = setup(probe)
      await runtime.login('mail', 'password', { username: 'alice', password: 'pw' })

      execute.mockResolvedValue(outcome)
      const resumed = restore()
      await resumed.resume('mail')

      expect(resumed.bind('mail').snapshot().status).toBe('expired')
    }
  })

  it('old rejection cannot expire new credentials; current rejection is idempotent', async () => {
    const { runtime } = setup({ execute: async () => ({ ok: true, rejected: false }) })
    const auth = runtime.bindForPlugin('mail')
    await runtime.login('mail', 'password', { username: 'alice', password: 'old' })
    let rejectOld = (): void => {
      throw new Error('not captured')
    }
    await auth.withCredential(async (_value, reject) => {
      rejectOld = reject
    })
    await runtime.login('mail', 'password', { username: 'alice', password: 'new' })
    rejectOld()
    expect(auth.snapshot().status).toBe('valid')
    await auth.withCredential(async (_value, reject) => {
      reject()
      reject()
    })
    expect(auth.snapshot()).toMatchObject({ status: 'expired', credentialRevision: 3 })
    await expect(auth.withCredential(async () => 'no')).rejects.toThrow()
  })
})
