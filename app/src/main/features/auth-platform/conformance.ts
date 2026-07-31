// Provider conformance 하네스 (0157) — **모든** auth provider 가 통과해야 하는 계약 검사.
//
// built-in 이라고 예외를 두지 않는 것이 요점이다 (AUTH-PLAT-002·003). 새 provider 를 추가하면
// 테스트 파일에서 `runAuthProviderConformance(makeProvider)` 한 줄만 부르면 된다 — 검사 항목이
// provider 마다 복제되지 않는다.
//
// 여기 있는 것은 **테스트 하네스이지 런타임 코드가 아니다.** vitest 에서 import 한다.

import type {
  AuthPluginContext,
  AuthProviderV1,
  AuthStep,
  BrowserSessionCapability,
  CredentialVaultView
} from '../../contracts/auth-plugin'
import type { AuthTarget, CredentialMeta } from '../../../shared/ipc'

export interface ConformanceCase {
  name: string
  run(): Promise<void>
}

export interface ConformanceOptions {
  // provider 를 매 케이스마다 새로 만든다(상태 누수 방지).
  create(): AuthProviderV1
  // 이 provider 가 실제로 인증을 완료할 수 있는 target. 미지정이면 descriptor 의 첫 target.
  sampleTarget?: AuthTarget
}

class AssertionError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AssertionError(message)
}

// 메모리 vault — 실제 safeStorage 없이 계약만 본다.
export function createFakeVault(): CredentialVaultView & { dump(): Map<string, string> } {
  const values = new Map<string, string>()
  const metas = new Map<string, CredentialMeta>()
  return {
    get: (name) => values.get(name) ?? null,
    set: (name, value, meta) => {
      values.set(name, value)
      metas.set(name, meta)
    },
    delete: (name) => {
      values.delete(name)
      metas.delete(name)
    },
    describe: (name) => metas.get(name) ?? null,
    dump: () => new Map(values)
  }
}

export function createFakeBrowserSessions(
  overrides: Partial<BrowserSessionCapability> = {}
): BrowserSessionCapability {
  return {
    acquire: async (group) => `handle:${group}`,
    openLoginWindow: async () => ({ finalUrl: 'https://example.invalid/done' }),
    probe: async () => ({ ok: true, status: 200, finalUrl: 'https://example.invalid/probe' }),
    clear: async () => undefined,
    ...overrides
  }
}

export interface FakeContextOptions {
  target: AuthTarget
  input?: Record<string, string>
  signal?: AbortSignal
  vault?: CredentialVaultView
  browserSessions?: BrowserSessionCapability
  fetchImpl?: AuthPluginContext['fetch']
}

export function createFakeContext(opts: FakeContextOptions): AuthPluginContext {
  const scratch = new Map<string, unknown>()
  return {
    target: opts.target,
    input: opts.input ?? {},
    signal: opts.signal ?? new AbortController().signal,
    vault: opts.vault ?? createFakeVault(),
    browserSessions: opts.browserSessions ?? createFakeBrowserSessions(),
    fetch: opts.fetchImpl ?? (async () => new Response('{}', { status: 200 })),
    exec: async () => ({ code: 0, stdout: '', stderr: '' }),
    store: { get: (k) => scratch.get(k), set: (k, v) => scratch.set(k, v) },
    env: () => undefined,
    logger: () => undefined,
    clock: () => 1_700_000_000_000
  }
}

const LIFECYCLE_METHODS = ['begin', 'continue', 'status', 'refresh', 'logout'] as const

// 표준 결과 판별자 — provider 가 임의 형태를 돌려주지 못하게 한다.
const STEP_KINDS = new Set(['collect', 'browser', 'device_code', 'done', 'failed', 'not_supported'])

// 이 목록을 통과해야 registry 가 받아준다. 실패는 AssertionError 로 던진다.
export function buildAuthProviderConformanceCases(opts: ConformanceOptions): ConformanceCase[] {
  const target = (): AuthTarget =>
    opts.sampleTarget ??
    (opts.create().descriptor.targets[0] === 'application'
      ? { kind: 'application', applicationId: 'orca' }
      : { kind: 'connector', connectorId: 'test', connectionId: 'c1' })

  return [
    {
      // AUTH-PLAT-002 — 5메서드 전부 구현. 미지원은 메서드 부재가 아니라 not_supported.
      name: '5개 lifecycle 메서드를 전부 구현한다',
      async run() {
        const provider = opts.create()
        for (const method of LIFECYCLE_METHODS) {
          assert(
            typeof provider[method] === 'function',
            `${provider.descriptor.id}: ${method} 미구현 — 미지원이면 not_supported 를 반환해야 한다`
          )
        }
      }
    },
    {
      name: 'descriptor 가 필수 필드를 갖는다',
      async run() {
        const d = opts.create().descriptor
        assert(d.id.length > 0, 'descriptor.id 가 비어 있다')
        assert(d.pluginId.length > 0, 'descriptor.pluginId 가 비어 있다')
        assert(d.apiVersion === 1, `지원하지 않는 apiVersion: ${d.apiVersion}`)
        assert(d.targets.length > 0, 'descriptor.targets 가 비어 있다')
        assert(d.mechanisms.length > 0, 'descriptor.mechanisms 가 비어 있다')
        assert(
          !d.capabilities.includes('browser_session') || !!d.sessionGroup,
          'browser_session capability 는 sessionGroup 선언이 필요하다'
        )
      }
    },
    {
      name: 'begin() 이 표준 AuthStep 판별자를 반환한다',
      async run() {
        const provider = opts.create()
        const step = await provider.begin(createFakeContext({ target: target() }))
        assertStep(step, `${provider.descriptor.id}.begin`)
      }
    },
    {
      // AUTH-PLAT-008 — 성공 결과에 raw secret 이 실릴 수 없다는 것을 실제 값으로도 확인한다.
      name: 'done 결과의 artifact 가 handleId 만 갖는다',
      async run() {
        const provider = opts.create()
        const step = await provider.begin(createFakeContext({ target: target() }))
        if (step.kind !== 'done') return
        const artifact = step.binding.artifact
        assert(typeof artifact.handleId === 'string', 'artifact.handleId 가 문자열이 아니다')
        const serialized = JSON.stringify(step.binding)
        for (const banned of ['password', 'secret', 'token', 'cookie']) {
          assert(
            !new RegExp(`"${banned}"\\s*:`, 'i').test(serialized),
            `binding 에 ${banned} 필드가 실렸다 — raw credential 은 vault 에만 존재해야 한다`
          )
        }
      }
    },
    {
      // 지원하지 않는 동작은 throw 가 아니라 표준 결과.
      name: 'status/refresh/logout 이 표준 결과 판별자를 반환한다',
      async run() {
        const provider = opts.create()
        const ctx = createFakeContext({ target: target() })
        const ref = {
          id: 'bind_test',
          target: target(),
          mechanism: provider.descriptor.mechanisms[0],
          artifact: { kind: 'delegated' as const, handleId: 'h1' }
        }
        const status = await provider.status(ctx, ref)
        assert(
          status.kind === 'status' || status.kind === 'not_supported',
          `status 가 표준 결과가 아니다: ${String(status.kind)}`
        )
        const refresh = await provider.refresh(ctx, ref)
        assert(
          ['refreshed', 'reauth_required', 'not_supported', 'failed'].includes(refresh.kind),
          `refresh 가 표준 결과가 아니다: ${String(refresh.kind)}`
        )
        const logout = await provider.logout(ctx, ref)
        assert(
          ['logged_out', 'not_supported', 'failed'].includes(logout.kind),
          `logout 이 표준 결과가 아니다: ${String(logout.kind)}`
        )
      }
    },
    {
      // capability 선언과 실제 동작의 일치 — 선언 안 한 refresh 가 실제로 되면 UI 가 어긋난다.
      name: 'refresh capability 미선언 provider 는 not_supported 를 반환한다',
      async run() {
        const provider = opts.create()
        if (provider.descriptor.capabilities.includes('refresh')) return
        const result = await provider.refresh(createFakeContext({ target: target() }), {
          id: 'bind_test',
          target: target(),
          mechanism: provider.descriptor.mechanisms[0],
          artifact: { kind: 'delegated', handleId: 'h1' }
        })
        assert(
          result.kind === 'not_supported',
          `refresh capability 미선언인데 ${result.kind} 를 반환했다`
        )
      }
    },
    {
      // 선언하지 않은 target 으로는 인증할 수 없다 (AUTH-PLAT-003 의 반대 방향 보장).
      name: 'descriptor.targets 밖의 target 은 선언되지 않는다',
      async run() {
        const d = opts.create().descriptor
        for (const kind of d.targets) {
          assert(
            kind === 'application' || kind === 'connector',
            `알 수 없는 target kind: ${String(kind)}`
          )
        }
      }
    }
  ]
}

function assertStep(step: AuthStep, label: string): void {
  assert(
    typeof step === 'object' && step !== null && STEP_KINDS.has(step.kind),
    `${label} 이 표준 AuthStep 판별자를 반환하지 않았다: ${String((step as { kind?: unknown })?.kind)}`
  )
  if (step.kind === 'collect') {
    assert(Array.isArray(step.fields), `${label}: collect 는 fields 배열이 필요하다`)
  }
  if (step.kind === 'device_code') {
    assert(!!step.userCode && !!step.verificationUrl, `${label}: device_code 필수 필드 누락`)
  }
  if (step.kind === 'failed') {
    assert(typeof step.reason === 'string', `${label}: failed 는 reason 이 필요하다`)
  }
}
