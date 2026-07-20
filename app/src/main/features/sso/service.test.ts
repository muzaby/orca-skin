import { describe, expect, it, vi } from 'vitest'
import { SsoService } from './service'
import type { SsoProviderModule } from '../../contracts/sso'
import type { SsoState } from '../../../shared/ipc'
import type { SecretStorePort } from '../../infra/config/secret-facade'

function memorySecrets(): SecretStorePort & { dump(): Record<string, string> } {
  const map = new Map<string, string>()
  return {
    get: (name) => map.get(name),
    set: (name, plain) => void map.set(name, plain),
    delete: (name) => void map.delete(name),
    dump: () => Object.fromEntries(map)
  }
}

function makeService(
  module: SsoProviderModule | null,
  overrides: Partial<ConstructorParameters<typeof SsoService>[0]> = {}
): { service: SsoService; broadcasts: SsoState[]; secrets: ReturnType<typeof memorySecrets> } {
  const broadcasts: SsoState[] = []
  const secrets = memorySecrets()
  const service = new SsoService({
    module,
    secretStore: secrets,
    writeProviderEnv: () => undefined,
    broadcastState: (s) => broadcasts.push(s),
    exec: async () => ({ code: 0, stdout: '', stderr: '' }),
    openAuthWindow: async () => ({ finalUrl: '', cookies: [] }),
    fetchImpl: (() => Promise.reject(new Error('no network'))) as unknown as typeof fetch,
    logger: () => undefined,
    ...overrides
  })
  return { service, broadcasts, secrets }
}

describe('SsoService — 모듈 미등록(기본 배포)', () => {
  it('required:false 를 보고하고 login 은 no-op', async () => {
    const login = vi.fn()
    const { service } = makeService(null)
    expect(service.status()).toMatchObject({
      required: false,
      authenticated: false,
      inflight: false,
      fields: []
    })
    const state = await service.login({ a: 'b' })
    expect(state.required).toBe(false)
    expect(state.authenticated).toBe(false)
    expect(login).not.toHaveBeenCalled()
  })

  it('restore 미구현/모듈 없음이면 아무것도 하지 않는다', async () => {
    const { service, broadcasts } = makeService(null)
    await service.restore()
    expect(broadcasts).toEqual([])
  })
})

describe('SsoService — login', () => {
  it('성공 시 authenticated + identity 전파 + 상태 브로드캐스트', async () => {
    const module: SsoProviderModule = {
      key: 'acme',
      fields: [{ name: 'id', label: '사번', type: 'text' }],
      login: async (ctx) => ({ ok: true, identity: { email: `${ctx.input.id}@acme.test` } })
    }
    const { service, broadcasts } = makeService(module)
    const state = await service.login({ id: 'e1' })
    expect(state).toMatchObject({
      required: true,
      authenticated: true,
      inflight: false,
      identity: { email: 'e1@acme.test' },
      errorMessage: null
    })
    expect(state.fields).toEqual([{ name: 'id', label: '사번', type: 'text' }])
    // inflight=true → 최종 상태의 2회 브로드캐스트.
    expect(broadcasts.map((s) => s.inflight)).toEqual([true, false])
  })

  it('실패 시 모듈 메시지를 노출하고 미인증 유지', async () => {
    const module: SsoProviderModule = {
      key: 'acme',
      login: async () => ({ ok: false, message: '사내망이 아닙니다' })
    }
    const { service } = makeService(module)
    const state = await service.login({})
    expect(state).toMatchObject({ authenticated: false, errorMessage: '사내망이 아닙니다' })
  })

  it('모듈 throw 는 { ok:false } 로 격리된다 (메시지 없음 → 카탈로그 폴백)', async () => {
    const module: SsoProviderModule = {
      key: 'acme',
      login: async () => {
        throw new Error('boom')
      }
    }
    const { service } = makeService(module)
    const state = await service.login({})
    expect(state).toMatchObject({ authenticated: false, errorMessage: null, inflight: false })
  })

  it('loginTimeoutMs 초과 시 abort 되어 실패로 수렴한다 (signal 무시 모듈 포함)', async () => {
    const module: SsoProviderModule = {
      key: 'acme',
      loginTimeoutMs: 20,
      login: () => new Promise(() => undefined) // never resolves, ignores signal
    }
    const { service } = makeService(module)
    const state = await service.login({})
    expect(state).toMatchObject({ authenticated: false, inflight: false })
  })

  it('inflight 중 중복 login 은 무시된다', async () => {
    let resolveLogin: (v: { ok: true }) => void = () => undefined
    const login = vi.fn(() => new Promise<{ ok: true }>((resolve) => (resolveLogin = resolve)))
    const module: SsoProviderModule = { key: 'acme', login }
    const { service } = makeService(module)
    const first = service.login({})
    const second = await service.login({})
    expect(second.inflight).toBe(true)
    resolveLogin({ ok: true })
    await first
    expect(login).toHaveBeenCalledTimes(1)
  })
})

describe('SsoService — restore (silent 복원)', () => {
  it('restore 성공 시 무입력으로 인증된다 (input={})', async () => {
    let seenInput: Record<string, string> | null = null
    const module: SsoProviderModule = {
      key: 'acme',
      login: async () => ({ ok: false }),
      restore: async (ctx) => {
        seenInput = ctx.input
        return { ok: true, identity: { displayName: 'cached' } }
      }
    }
    const { service } = makeService(module)
    await service.restore()
    expect(seenInput).toEqual({})
    expect(service.status()).toMatchObject({
      authenticated: true,
      identity: { displayName: 'cached' }
    })
  })

  it('restore null/실패/throw 는 조용히 미인증 유지 (에러 노출 없음)', async () => {
    for (const restore of [
      async () => null,
      async () => ({ ok: false as const, message: 'stale' }),
      async () => {
        throw new Error('offline')
      }
    ]) {
      const module: SsoProviderModule = { key: 'acme', login: async () => ({ ok: false }), restore }
      const { service } = makeService(module)
      await service.restore()
      expect(service.status()).toMatchObject({ authenticated: false, errorMessage: null })
    }
  })
})

describe('SsoService — 컨텍스트 (토큰 공유 핸드셰이크)', () => {
  it('secret 은 sso:<key>: 네임스페이스, providerSecrets 는 provider:<providerKey>: 네임스페이스', async () => {
    const module: SsoProviderModule = {
      key: 'acme',
      login: async (ctx) => {
        ctx.secret.set('session-token', 't-sso')
        ctx.providerSecrets('claude-inhouse').set('usage-report-token', 't-shared')
        return { ok: true }
      }
    }
    const { service, secrets } = makeService(module)
    await service.login({})
    expect(secrets.dump()).toEqual({
      'sso:acme:session-token': 't-sso',
      'provider:claude-inhouse:usage-report-token': 't-shared'
    })
  })

  it('setProviderEnv 는 주입된 writeProviderEnv thunk 로 위임된다', async () => {
    const writeProviderEnv = vi.fn()
    const module: SsoProviderModule = {
      key: 'acme',
      login: async (ctx) => {
        ctx.setProviderEnv('claude', 'inhouse', { ANTHROPIC_AUTH_TOKEN: 'tok' })
        return { ok: true }
      }
    }
    const { service } = makeService(module, { writeProviderEnv })
    await service.login({})
    expect(writeProviderEnv).toHaveBeenCalledWith('claude', 'inhouse', {
      ANTHROPIC_AUTH_TOKEN: 'tok'
    })
  })

  it('store 는 login ↔ restore 간 유지되는 모듈 전용 KV', async () => {
    const module: SsoProviderModule = {
      key: 'acme',
      login: async (ctx) => {
        ctx.store.set('expiresAt', 123)
        return { ok: false }
      },
      restore: async (ctx) => (ctx.store.get('expiresAt') === 123 ? { ok: true } : null)
    }
    const { service } = makeService(module)
    await service.login({})
    await service.restore()
    expect(service.status().authenticated).toBe(true)
  })
})
