// 부팅 Auth 복원 순서와 방송 상한 (0188 — 구 `LoginService` sweep 테스트의 이식).
//
// 0181 은 순서·병렬성·통지 합치기를 `LoginService` 안에 뒀고 그 테스트도 거기 있었다.
// 0188 이 그 정책을 app 레이어로 옮겼으므로 검증도 따라온다 — **같은 행동을 계속 단언한다**:
// 게이트 우선 · 나머지 병렬 · 실패 즉시 통지 · 성공 batch 는 마지막 1회.

import { describe, expect, it, vi } from 'vitest'
import type {
  AuthChange,
  AuthDefinition,
  AuthMethod,
  AuthMethodKind,
  AuthId,
  AuthRuntime,
  AuthSnapshot,
  AuthStep,
  BoundAuth
} from '../contracts/auth'
import { createAuthResume, gateOpen } from './auth-resume'

// 방식은 **첫 원소만** 자동 재로그인 판정에 쓰인다 — 나머지는 형태를 갖추기 위한 것이다.
function method(kind: AuthMethodKind): AuthMethod {
  const present = { location: 'header', name: 'Authorization', scheme: 'bearer' } as const
  if (kind === 'browser-session') {
    return {
      kind,
      label: kind,
      config: {
        sessionGroup: 'corp',
        loginUrl: 'https://idp.example.corp/login',
        doneUrlPrefix: 'https://idp.example.corp/done',
        allowedOrigins: ['https://idp.example.corp']
      }
    }
  }
  if (kind === 'oauth') {
    return { kind, label: kind, present, authorize: () => Promise.reject(new Error('not used')) }
  }
  return { kind, label: kind, fields: [], present, compose: () => ({ value: 'v' }) }
}

function definition(
  id: string,
  withProbe = true,
  methodKinds: readonly AuthMethodKind[] = []
): AuthDefinition {
  return {
    id,
    label: id,
    origin: `https://${id}.example.corp`,
    methods: methodKinds.map(method),
    ...(withProbe ? { probe: { path: '/api/me' } } : {})
  }
}

// 재로그인 시도가 돌려줄 결말. `LoginService` 가 실제로 낼 수 있는 5종을 그대로 쓴다.
// `throws` 는 step 이 아니라 예외다 — `login` 에는 `resume` 과 달리 "던지지 않는다" 는 계약이 없다.
type LoginOutcome =
  'done' | 'probe_failed' | 'cancelled' | 'input-required' | 'code-required' | 'throws'

function stepOf(authId: string, outcome: Exclude<LoginOutcome, 'throws'>): AuthStep {
  switch (outcome) {
    case 'done':
      return { kind: 'done', providerId: authId }
    case 'input-required':
      return { kind: 'input-required', providerId: authId, authKind: 'pat', fields: [] }
    case 'code-required':
      return {
        kind: 'code-required',
        providerId: authId,
        authKind: 'oauth',
        url: 'https://idp.example.corp/code'
      }
    default:
      return { kind: 'failed', providerId: authId, reason: outcome, message: outcome }
  }
}

// 진행 중인 promise 체인을 비운다. 재로그인은 probe batch 뒤에 오므로 microtask 한 번으로는
// 관측 지점에 도달하지 못한다.
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

interface FakeState {
  status: AuthSnapshot['status']
  verified: boolean
  probeOk: boolean
  // 재로그인 시도가 차례로 돌려줄 결말. 다 쓰면 마지막 값을 반복한다. 미지정이면 계속 실패한다.
  logins?: readonly LoginOutcome[]
}

// 실제 `AuthRuntime` 을 흉내내되 **순서를 관측할 수 있게** 한다: resume 진입/이탈을 로그에
// 남기고, 나머지 batch 의 병렬성은 "모두 진입한 뒤에야 첫 이탈이 일어나는가" 로 본다.
function fakeRuntime(
  initial: Record<string, FakeState>,
  hold: readonly string[] = [],
  holdLogin: readonly string[] = []
): {
  auth: AuthRuntime
  log: string[]
  release: (id: string) => void
  releaseLogin: (id: string) => void
  setState: (id: string, patch: Partial<FakeState>) => void
  broadcast: ReturnType<typeof vi.fn<() => void>>
} {
  const states = new Map(Object.entries(initial))
  const log: string[] = []
  // `release()` 로 완료 시점을 제어할 대상. 병렬성 관측에만 쓴다.
  const gates = new Map<string, (() => void) | null>()
  for (const id of hold) gates.set(id, null)
  // 로그인 gate 는 **일회성**이다 — 풀면 키를 지워, 붙들 의도가 없던 다음 시도가 매달리지 않는다.
  const loginGates = new Map<string, (() => void) | null>()
  for (const id of holdLogin) loginGates.set(id, null)
  const loginCounts = new Map<string, number>()
  const listeners = new Set<(change: AuthChange) => void>()
  const broadcast = vi.fn<() => void>()

  const snapshotOf = (authId: AuthId): AuthSnapshot => {
    const state = states.get(authId)
    return {
      authId,
      status: state?.status ?? 'none',
      verified: state?.verified ?? false,
      credentialRevision: 0
    }
  }

  const bind = (authId: AuthId): BoundAuth => ({
    authId,
    snapshot: () => snapshotOf(authId),
    request: () => Promise.reject(new Error('not used'))
  })

  const auth: AuthRuntime = {
    bind,
    tryBind: (authId) => (states.has(authId) ? bind(authId) : null),
    describe: (authId) => ({ authId, label: authId, origin: '', methods: [] }),
    currentStep: () => null,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async resume(authId, options) {
      const state = states.get(authId)
      // 실제 `LoginService.resume` 과 같은 조기 반환 — grant 가 없거나 이미 확인됐으면 묻지
      // 않는다. 이것이 없으면 "묻지 않았다" 를 관측할 수 없다.
      if (!state || state.status !== 'valid' || state.verified) return
      log.push(`enter:${authId}`)
      await new Promise<void>((resolve) => {
        if (!gates.has(authId)) resolve()
        else gates.set(authId, resolve)
      })
      if (state.probeOk) {
        state.verified = true
        if (options?.emitVerifiedChange ?? true) {
          broadcast()
          for (const listener of listeners) {
            listener({
              kind: 'snapshot',
              authId,
              cause: 'verified',
              snapshot: snapshotOf(authId),
              credentialChanged: false
            })
          }
        }
      } else {
        state.status = 'expired'
        state.verified = false
        // 실패 강등은 credential-effective — `emitVerifiedChange` 와 무관하게 즉시 방송된다.
        broadcast()
      }
      log.push(`exit:${authId}`)
    },
    async login(authId) {
      const attempt = (loginCounts.get(authId) ?? 0) + 1
      loginCounts.set(authId, attempt)
      log.push(`login:${authId}:${attempt}`)
      await new Promise<void>((resolve) => {
        if (!loginGates.has(authId)) resolve()
        else loginGates.set(authId, resolve)
      })
      const state = states.get(authId)
      const outcomes = state?.logins ?? ['probe_failed']
      const outcome = outcomes[Math.min(attempt - 1, outcomes.length - 1)] ?? 'probe_failed'
      if (outcome === 'throws') throw new Error(`login exploded: ${authId}`)
      // 성공만 상태를 바꾼다 — 실패한 로그인은 아무것도 쓰지 않는다(`settleGrant` 의 r5 계약).
      if (outcome === 'done' && state) {
        state.status = 'valid'
        state.verified = true
      }
      return stepOf(authId, outcome)
    },
    continue: () => Promise.reject(new Error('not used')),
    reauth: () => Promise.reject(new Error('not used')),
    revoke: () => undefined
  }

  return {
    auth,
    log,
    release: (id) => gates.get(id)?.(),
    releaseLogin: (id) => {
      const resolve = loginGates.get(id)
      loginGates.delete(id)
      resolve?.()
    },
    setState: (id, patch) => {
      const state = states.get(id)
      if (state) Object.assign(state, patch)
    },
    broadcast
  }
}

const restored = (probeOk: boolean): FakeState => ({
  status: 'valid',
  verified: false,
  probeOk
})

describe('createAuthResume — 순서', () => {
  it('게이트가 실패하면 나머지는 건드리지 않는다 — 순서가 규칙이다', async () => {
    // 사내 서비스는 대개 게이트와 같은 cookie jar 를 쓴다. 로그인 전에 물으면 살아 있는
    // 연결도 미인증으로 떨어지고, 한 번 강등되면 스스로 회복하지 못한다.
    const { auth, log, broadcast } = fakeRuntime({
      sso: restored(false),
      wiki: restored(true)
    })
    await createAuthResume({
      auth,
      gateDefinitions: [definition('sso')],
      remainingDefinitions: [definition('wiki')],
      pushConnectionState: broadcast
    }).run()

    expect(log).toEqual(['enter:sso', 'exit:sso'])
  })

  it('게이트 통과 후 나머지를 확인한다', async () => {
    const { auth, log, broadcast } = fakeRuntime({
      sso: restored(true),
      wiki: restored(true)
    })
    await createAuthResume({
      auth,
      gateDefinitions: [definition('sso')],
      remainingDefinitions: [definition('wiki')],
      pushConnectionState: broadcast
    }).run()

    expect(log).toEqual(['enter:sso', 'exit:sso', 'enter:wiki', 'exit:wiki'])
  })

  it('게이트 선언이 없으면 부팅 직후 바로 나머지를 확인한다', async () => {
    const { auth, log, broadcast } = fakeRuntime({ wiki: restored(true) })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [definition('wiki')],
      pushConnectionState: broadcast
    }).run()

    expect(log).toEqual(['enter:wiki', 'exit:wiki'])
  })

  it('probe 가 없거나 grant 가 없는 Auth 는 묻지 않는다', async () => {
    const { auth, log, broadcast } = fakeRuntime({
      noprobe: restored(true),
      nograant: { status: 'none', verified: false, probeOk: true },
      done: { status: 'valid', verified: true, probeOk: true }
    })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [
        definition('noprobe', false),
        definition('nograant'),
        definition('done')
      ],
      pushConnectionState: broadcast
    }).run()

    expect(log).toEqual([])
  })

  it('나머지는 병렬로 묻는다 — 직렬이면 probe 타임아웃이 Auth 수만큼 쌓인다', async () => {
    const { auth, log, release, broadcast } = fakeRuntime(
      { a: restored(true), b: restored(true) },
      ['a', 'b']
    )
    // 두 resume 을 붙들어 둔다.
    const runtime = createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [definition('a'), definition('b')],
      pushConnectionState: broadcast
    })
    const pending = runtime.run()
    await Promise.resolve()
    // 직렬이면 여기서 `enter:b` 가 아직 없다.
    expect(log).toEqual(['enter:a', 'enter:b'])
    release('a')
    release('b')
    await pending
    expect(log).toEqual(['enter:a', 'enter:b', 'exit:a', 'exit:b'])
  })
})

describe('createAuthResume — 방송 상한 1 + K (0187 D2 승계)', () => {
  it('전부 성공하면 마지막 full-state push 한 번이다', async () => {
    const { auth, broadcast } = fakeRuntime({
      a: restored(true),
      b: restored(true),
      c: restored(true)
    })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [definition('a'), definition('b'), definition('c')],
      pushConnectionState: broadcast
    }).run()

    // 성공 3건은 `emitVerifiedChange:false` 로 억제되고 마지막 push 하나로 합쳐진다.
    expect(broadcast).toHaveBeenCalledTimes(1)
  })

  it('실패 K 건은 즉시 방송된다 — 총 1 + K', async () => {
    const { auth, broadcast } = fakeRuntime({
      a: restored(true),
      b: restored(false),
      c: restored(false)
    })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [definition('a'), definition('b'), definition('c')],
      pushConnectionState: broadcast
    }).run()

    // K=2 — 죽은 연결의 도구가 남은 probe 타임아웃만큼 화면에 남지 않도록 즉시 낸다.
    expect(broadcast).toHaveBeenCalledTimes(3)
  })
})

describe('createAuthResume — 게이트가 나중에 열리는 경우', () => {
  it('같은 batch 를 두 번 돌지 않는다', async () => {
    const { auth, log, broadcast } = fakeRuntime({
      sso: restored(true),
      wiki: restored(true)
    })
    const resume = createAuthResume({
      auth,
      gateDefinitions: [definition('sso')],
      remainingDefinitions: [definition('wiki')],
      pushConnectionState: broadcast
    })
    await resume.run()
    resume.onGateChange('sso')
    resume.onGateChange('sso')
    await Promise.resolve()

    expect(log.filter((entry) => entry === 'enter:wiki')).toHaveLength(1)
  })

  it('gate 가 아닌 authId 는 batch 를 깨우지 않는다', async () => {
    const { auth, log, broadcast } = fakeRuntime({
      sso: { status: 'none', verified: false, probeOk: true },
      wiki: restored(true)
    })
    const resume = createAuthResume({
      auth,
      gateDefinitions: [definition('sso')],
      remainingDefinitions: [definition('wiki')],
      pushConnectionState: broadcast
    })
    await resume.run()
    resume.onGateChange('wiki')
    await Promise.resolve()

    // 게이트가 아직 안 열렸으므로 wiki batch 는 시작되지 않는다.
    expect(log).not.toContain('enter:wiki')
  })
})

// 재로그인 대상 — probe 는 실패하고 methods[0] 는 자동 완주 가능한 방식이다.
const demoted = (logins?: readonly LoginOutcome[]): FakeState => ({
  status: 'valid',
  verified: false,
  probeOk: false,
  ...(logins ? { logins } : {})
})

const session = (id: string): AuthDefinition => definition(id, true, ['browser-session'])

function loginsOf(log: readonly string[], id: string): string[] {
  return log.filter((entry) => entry.startsWith(`login:${id}:`))
}

describe('createAuthResume — 복원 실패 후 자동 재로그인 (0193)', () => {
  it('probe 가 실패해 강등되면 methods[0] 방식으로 다시 로그인한다', async () => {
    const { auth, log, broadcast } = fakeRuntime({ wiki: demoted(['done']) })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [session('wiki')],
      pushConnectionState: broadcast
    }).run()

    expect(loginsOf(log, 'wiki')).toEqual(['login:wiki:1'])
  })

  it('로그인이 성공하면 그 자리에서 멈추고 그 Auth 는 확인된 상태가 된다', async () => {
    const { auth, log, broadcast } = fakeRuntime({ wiki: demoted(['done']) })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [session('wiki')],
      pushConnectionState: broadcast
    }).run()

    expect(loginsOf(log, 'wiki')).toHaveLength(1)
    expect(auth.tryBind('wiki')?.snapshot()).toMatchObject({ status: 'valid', verified: true })
  })

  it('확인 실패가 이어지면 최대 3회까지만 시도한다 — 4번째는 없다', async () => {
    const { auth, log, broadcast } = fakeRuntime({ wiki: demoted(['probe_failed']) })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [session('wiki')],
      pushConnectionState: broadcast
    }).run()

    expect(loginsOf(log, 'wiki')).toEqual(['login:wiki:1', 'login:wiki:2', 'login:wiki:3'])
  })

  it.each(['cancelled', 'input-required', 'code-required'] as const)(
    '%s 는 남은 횟수와 무관하게 즉시 중단한다 — 사용자가 닫은 창을 다시 열지 않는다',
    async (outcome) => {
      const { auth, log, broadcast } = fakeRuntime({ wiki: demoted([outcome]) })
      await createAuthResume({
        auth,
        gateDefinitions: [],
        remainingDefinitions: [session('wiki')],
        pushConnectionState: broadcast
      }).run()

      expect(loginsOf(log, 'wiki')).toEqual(['login:wiki:1'])
    }
  )

  it('첫 시도가 확인 실패고 두 번째가 성공이면 두 번에서 멈춘다', async () => {
    const { auth, log, broadcast } = fakeRuntime({ wiki: demoted(['probe_failed', 'done']) })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [session('wiki')],
      pushConnectionState: broadcast
    }).run()

    expect(loginsOf(log, 'wiki')).toEqual(['login:wiki:1', 'login:wiki:2'])
  })

  it.each(['api-key', 'password', 'pat'] as const)(
    'methods[0] 가 %s 면 로그인을 한 번도 부르지 않는다 — 입력 폼만 남기는 시도다',
    async (kind) => {
      const { auth, log, broadcast } = fakeRuntime({ wiki: demoted(['done']) })
      await createAuthResume({
        auth,
        gateDefinitions: [],
        remainingDefinitions: [definition('wiki', true, [kind])],
        pushConnectionState: broadcast
      }).run()

      expect(loginsOf(log, 'wiki')).toEqual([])
    }
  )

  it('methods 가 비면 로그인을 부르지 않는다', async () => {
    const { auth, log, broadcast } = fakeRuntime({ wiki: demoted(['done']) })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [definition('wiki')],
      pushConnectionState: broadcast
    }).run()

    expect(loginsOf(log, 'wiki')).toEqual([])
  })

  it('입력형 뒤에 browser-session 이 있어도 시도하지 않는다 — 보는 것은 첫 방식뿐이다', async () => {
    const { auth, log, broadcast } = fakeRuntime({ wiki: demoted(['done']) })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [definition('wiki', true, ['pat', 'browser-session'])],
      pushConnectionState: broadcast
    }).run()

    expect(loginsOf(log, 'wiki')).toEqual([])
  })

  it('재로그인은 순차다 — 첫 로그인이 끝나야 두 번째가 시작된다', async () => {
    // 창이 동시에 여러 개 뜨지 않아야 한다. 병렬이면 아래 첫 flush 에서 login:b:1 이 이미 있다.
    const { auth, log, releaseLogin, broadcast } = fakeRuntime(
      { a: demoted(['done']), b: demoted(['done']) },
      [],
      ['a', 'b']
    )
    const pending = createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [session('a'), session('b')],
      pushConnectionState: broadcast
    }).run()

    await flush()
    // probe 는 병렬(enter 두 개가 먼저), 로그인은 a 하나만 떠 있다.
    expect(log).toEqual(['enter:a', 'enter:b', 'exit:a', 'exit:b', 'login:a:1'])
    releaseLogin('a')
    await flush()
    expect(log).toContain('login:b:1')
    releaseLogin('b')
    await pending
    expect(loginsOf(log, 'a')).toEqual(['login:a:1'])
    expect(loginsOf(log, 'b')).toEqual(['login:b:1'])
  })

  it.each([
    { status: 'none', why: '사용자가 연결을 해제했다' },
    { status: 'valid', why: '사용자가 직접 로그인을 시작했다' }
  ] as const)(
    '시도 사이에 상태가 $status 가 되면 다음 시도를 하지 않는다 ($why)',
    async ({ status }) => {
      const { auth, log, releaseLogin, setState, broadcast } = fakeRuntime(
        { wiki: demoted(['probe_failed']) },
        [],
        ['wiki']
      )
      const pending = createAuthResume({
        auth,
        gateDefinitions: [],
        remainingDefinitions: [session('wiki')],
        pushConnectionState: broadcast
      }).run()

      await flush()
      expect(loginsOf(log, 'wiki')).toEqual(['login:wiki:1'])
      // 1회차가 도는 사이 사용자가 개입한다.
      setState('wiki', { status })
      releaseLogin('wiki')
      await pending

      expect(loginsOf(log, 'wiki')).toEqual(['login:wiki:1'])
    }
  )

  it('강등되지 않은 Auth 는 시도 대상이 아니다 — probe 가 성공했으면 로그인하지 않는다', async () => {
    const { auth, log, broadcast } = fakeRuntime({ wiki: { ...restored(true), logins: ['done'] } })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [session('wiki')],
      pushConnectionState: broadcast
    }).run()

    expect(loginsOf(log, 'wiki')).toEqual([])
  })

  it('gate Auth 의 복원 실패는 재로그인하지 않는다 — 대상은 나머지 Auth 뿐이다', async () => {
    const { auth, log, broadcast } = fakeRuntime({ sso: demoted(['done']) })
    await createAuthResume({
      auth,
      gateDefinitions: [session('sso')],
      remainingDefinitions: [],
      pushConnectionState: broadcast
    }).run()

    expect(loginsOf(log, 'sso')).toEqual([])
  })

  it('시도 시작과 결과를 logger 로 남긴다', async () => {
    const logger = vi.fn<(event: string, data: Record<string, unknown>) => void>()
    const { auth, broadcast } = fakeRuntime({ wiki: demoted(['probe_failed', 'done']) })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [session('wiki')],
      pushConnectionState: broadcast,
      logger
    }).run()

    expect(logger.mock.calls).toEqual([
      ['auth.resume.relogin.start', { authId: 'wiki', attempt: 1 }],
      [
        'auth.resume.relogin.result',
        { authId: 'wiki', attempt: 1, step: 'failed', reason: 'probe_failed' }
      ],
      ['auth.resume.relogin.start', { authId: 'wiki', attempt: 2 }],
      ['auth.resume.relogin.result', { authId: 'wiki', attempt: 2, step: 'done' }]
    ])
  })

  it('로그인이 던져도 그 Auth 만 멈추고 다음 Auth 와 마지막 방송이 이어진다', async () => {
    // `login` 에는 `resume` 의 "부팅 경로라 던지지 않는다" 계약이 없다(`sessions.acquire` 는 raw
    // throw). 흘려보내면 fire-and-forget 부팅 경로에서 나머지가 통째로 사라진다.
    const logger = vi.fn<(event: string, data: Record<string, unknown>) => void>()
    const { auth, log, broadcast } = fakeRuntime({ a: demoted(['throws']), b: demoted(['done']) })
    await expect(
      createAuthResume({
        auth,
        gateDefinitions: [],
        remainingDefinitions: [session('a'), session('b')],
        pushConnectionState: broadcast,
        logger
      }).run()
    ).resolves.toBeUndefined()

    expect(loginsOf(log, 'a')).toEqual(['login:a:1'])
    expect(loginsOf(log, 'b')).toEqual(['login:b:1'])
    // 강등 즉시 방송 2(K=2) + batch push 1 + 재시도 push 1.
    expect(broadcast).toHaveBeenCalledTimes(4)
    expect(logger).toHaveBeenCalledWith('auth.resume.relogin.threw', {
      authId: 'a',
      attempt: 1,
      reason: 'login exploded: a'
    })
  })

  it('재시도가 있었으면 마지막에 한 번 더 방송한다', async () => {
    // 성공 1건(K=0) → probe batch push 1 + 재시도 push 1.
    const { auth, broadcast } = fakeRuntime({ wiki: demoted(['done']) })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [session('wiki')],
      pushConnectionState: broadcast
    }).run()

    // 강등 즉시 방송 1(K=1) + batch push 1 + 재시도 push 1.
    expect(broadcast).toHaveBeenCalledTimes(3)
  })
})

describe('gateOpen', () => {
  it('선언이 0개면 열린 것으로 본다', () => {
    const { auth } = fakeRuntime({})
    expect(gateOpen(auth, [])).toBe(true)
  })

  it('valid 만으로는 열리지 않는다 — verified 까지 요구한다', () => {
    const { auth } = fakeRuntime({ sso: { status: 'valid', verified: false, probeOk: true } })
    expect(gateOpen(auth, [definition('sso')])).toBe(false)
  })

  it('valid + verified 면 열린다', () => {
    const { auth } = fakeRuntime({ sso: { status: 'valid', verified: true, probeOk: true } })
    expect(gateOpen(auth, [definition('sso')])).toBe(true)
  })
})
