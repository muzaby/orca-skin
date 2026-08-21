// 부팅 Auth 복원 순서와 방송 상한 (0188 — 구 `LoginService` sweep 테스트의 이식).
//
// 0181 은 순서·병렬성·통지 합치기를 `LoginService` 안에 뒀고 그 테스트도 거기 있었다.
// 0188 이 그 정책을 app 레이어로 옮겼으므로 검증도 따라온다 — **같은 행동을 계속 단언한다**:
// 게이트 우선 · 나머지 병렬 · 실패 즉시 통지 · 성공 batch 는 마지막 1회.

import { describe, expect, it, vi } from 'vitest'
import type {
  AuthChange,
  AuthDefinition,
  AuthRefreshResult,
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
  | 'done'
  | 'probe_failed'
  | 'cancelled'
  | 'unsupported'
  | 'input-required'
  | 'code-required'
  | 'throws'

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
  // refresh 가 돌려줄 결과. 미지정이면 `unsupported` — 대다수 배포(선언에 refresh 없음)의 형상이다.
  // **가능 판정은 여기서 흉내내지 않는다** — 그것은 `LoginService.refresh` 의 몫이고
  // (계약 §10) 이 모듈은 결과만 본다. 판정 자체는 `features/auth/login.test.ts` 가 잠근다.
  refresh?: AuthRefreshResult | 'throws'
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
    async refresh(authId) {
      log.push(`refresh:${authId}`)
      const state = states.get(authId)
      const outcome = state?.refresh ?? 'unsupported'
      if (outcome === 'throws') throw new Error(`refresh exploded: ${authId}`)
      // 성공만 상태를 바꾼다 — 실패한 refresh 는 아무것도 쓰지 않는다(`settleGrant` 계약).
      if (outcome === 'refreshed' && state) {
        state.status = 'valid'
        state.verified = true
      }
      return outcome
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
    // 후보가 0건이라 batch push 도 회복 시도도 없다. 그래도 **복원 종료 push 1회는 있다**
    // (0194) — 게이트가 열린 시점에 `resuming:true` 가 이미 나갔으므로 그것을 거둬야 한다.
    expect(broadcast).toHaveBeenCalledTimes(1)
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

// **여기가 잠그는 것은 `createAuthResume` 이 *스스로* 부르는 push 뿐이다 — `P + 1`.**
// `P` = probe 후보가 있으면 1, 없으면 **0**(batch push 는 후보가 있을 때만 나간다) · `+1` = 복원
// 종료 push(시도 유무 무관). 아래 세 케이스가 `P` 를 독립으로 움직인다 — `P` 를 0 으로 내린
// 케이스가 없으면 batch push 를 무조건으로 만들어도 전건 green 이다(0194 D12 가 그 자리였다).
//
// 기대값에 섞여 있는 `K` 는 자기 push 가 아니라 **change 구독**이 내는 몫이다. 이 fake 는
// `resume` 에서만 `broadcast()` 를 부르므로 그 경로를 강등까지만 모형한다 — 프로덕션에서 같은
// 클로저를 부르는 `login`·`refresh` 의 change 는 **여기 없다**. 그래서 부팅 총량은 이 describe
// 로 단언하지 않는다(0194 D19: 총량을 적었더니 관측 지점이 못 보는 항이 네 라운드를 살아남았다).
describe('createAuthResume — 자기 push 는 P + 1 (0187 D2 승계 · 0194 종료 push)', () => {
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

    // 자기 push 2 (batch P=1 + 종료 1) + resume 이 낸 change 0 (K=0 — 성공 3건은
    // `emitVerifiedChange:false` 로 억제되고 batch push 하나로 합쳐진다).
    expect(broadcast).toHaveBeenCalledTimes(2)
  })

  it('실패 K 건은 즉시 방송된다 — P=1·K=2', async () => {
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

    // 자기 push 2 (batch P=1 + 종료 1) + resume 이 낸 change 2 (K=2 — 죽은 연결의 도구가 남은
    // probe 타임아웃만큼 화면에 남지 않도록 즉시 낸다).
    expect(broadcast).toHaveBeenCalledTimes(4)
  })

  it('probe 후보가 0건이면 batch push 자체가 없다 — P=0·K=0', async () => {
    // 선언에 `probe` 가 없으면 후보 필터가 걸러낸다. `valid` 라 회복 대상도 아니므로 K=0 이다.
    const { auth, broadcast } = fakeRuntime({ noprobe: restored(true) })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [definition('noprobe', false)],
      pushConnectionState: broadcast
    }).run()

    // 자기 push 1 (batch 없음 P=0 + 종료 1) + change 0. 이 케이스가 `P` 항을 잠근다 —
    // batch push 를 무조건으로 만들면 여기만 2가 된다.
    expect(broadcast).toHaveBeenCalledTimes(1)
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

  it.each(['cancelled', 'unsupported', 'input-required', 'code-required'] as const)(
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
      // 강등 즉시 방송 1(K=1) + batch push 1 + 복원 종료 push 1.
      expect(broadcast).toHaveBeenCalledTimes(3)
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
    // refresh 가 재로그인보다 **먼저**다 — 창을 열지 않으므로 먼저 시도한다(0194 AC4).
    expect(log).toEqual(['enter:a', 'enter:b', 'exit:a', 'exit:b', 'refresh:a', 'login:a:1'])
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
    // 강등이 없어 K=0 → batch push 1 + 복원 종료 push 1. (0193 의 조건부 `attempted` push 는
    // 0194 에서 무조건 종료 push 로 대체됐다 — 시도가 없어도 `resuming` 을 거둬야 한다.)
    expect(broadcast).toHaveBeenCalledTimes(2)
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
      // refresh 가 먼저 시도되고(불가) 그 다음이 재로그인이다.
      ['auth.resume.refresh.start', { authId: 'wiki' }],
      ['auth.resume.refresh.result', { authId: 'wiki', result: 'unsupported' }],
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
    // `login` 에는 `resume` 의 "부팅 경로라 던지지 않는다" 계약이 없다 — 주입 포트를 try 밖에서
    // 부르는 자리가 있다(`oauth-runner.ts` 의 `states.issue`·`listen`). 흘려보내면
    // fire-and-forget 부팅 경로에서 나머지가 통째로 사라진다.
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

// ── 0194 ────────────────────────────────────────────────────────────────────

// 부팅 시점에 **이미 시계상 만료된** grant. probe 후보 필터(`status==='valid'`)에 걸리지
// 않으므로 0193 까지는 회복 대상 밖이었다 — 앱이 꺼져 있는 동안 토큰이 만료된 형상이다.
const stale = (patch?: Partial<FakeState>): FakeState => ({
  status: 'expired',
  verified: false,
  probeOk: true,
  ...patch
})

describe('createAuthResume — 부팅 시점에 이미 만료된 grant (0194)', () => {
  it('probe 후보가 아니어도 회복 대상이다 — 재로그인을 시도한다', async () => {
    const { auth, log, broadcast } = fakeRuntime({ wiki: stale({ logins: ['done'] }) })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [session('wiki')],
      pushConnectionState: broadcast
    }).run()

    expect(loginsOf(log, 'wiki')).toEqual(['login:wiki:1'])
  })

  it('만료된 것에는 probe 를 묻지 않는다 — 정책이 요청 자체를 막는다', async () => {
    const { auth, log, broadcast } = fakeRuntime({ wiki: stale({ logins: ['done'] }) })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [session('wiki')],
      pushConnectionState: broadcast
    }).run()

    expect(log).not.toContain('enter:wiki')
  })

  it('probe 후보가 0건이어도 회복 패스는 돈다 — 조기 반환이 회복을 건너뛰지 않는다', async () => {
    // 전건이 만료라 probe 대상이 하나도 없다. 0193 은 여기서 조기 반환해 회복이 통째로 없었다.
    const { auth, log, broadcast } = fakeRuntime({
      wiki: stale({ logins: ['done'] }),
      jira: stale({ logins: ['done'] })
    })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [session('wiki'), session('jira')],
      pushConnectionState: broadcast
    }).run()

    expect(log.filter((entry) => entry.startsWith('enter:'))).toEqual([])
    expect(loginsOf(log, 'wiki')).toEqual(['login:wiki:1'])
    expect(loginsOf(log, 'jira')).toEqual(['login:jira:1'])
  })

  it('만료됐어도 입력형이면 재로그인하지 않는다 — probe 단계 방송 상한도 그대로다', async () => {
    const { auth, log, broadcast } = fakeRuntime({ wiki: stale({ logins: ['done'] }) })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [definition('wiki', true, ['pat'])],
      pushConnectionState: broadcast
    }).run()

    expect(loginsOf(log, 'wiki')).toEqual([])
    // probe 대상 0 · 강등 0 → P=0·K=0. 복원 종료 push 1회가 전부다.
    expect(broadcast).toHaveBeenCalledTimes(1)
  })
})

describe('createAuthResume — OAuth refresh (0194)', () => {
  it('refresh 가 재로그인보다 먼저다', async () => {
    const { auth, log, broadcast } = fakeRuntime({
      wiki: stale({ refresh: 'failed', logins: ['done'] })
    })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [session('wiki')],
      pushConnectionState: broadcast
    }).run()

    expect(log).toEqual(['refresh:wiki', 'login:wiki:1'])
  })

  it('refresh 가 성공하면 로그인을 한 번도 부르지 않는다 — 창이 뜨지 않는다', async () => {
    const { auth, log, broadcast } = fakeRuntime({
      wiki: stale({ refresh: 'refreshed', logins: ['done'] })
    })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [session('wiki')],
      pushConnectionState: broadcast
    }).run()

    expect(log).toEqual(['refresh:wiki'])
    expect(auth.tryBind('wiki')?.snapshot()).toMatchObject({ status: 'valid', verified: true })
  })

  it.each(['failed', 'unsupported'] as const)(
    'refresh 가 %s 면 두 번 부르지 않고 재로그인 3회로 넘어간다',
    async (result) => {
      const { auth, log, broadcast } = fakeRuntime({ wiki: stale({ refresh: result }) })
      await createAuthResume({
        auth,
        gateDefinitions: [],
        remainingDefinitions: [session('wiki')],
        pushConnectionState: broadcast
      }).run()

      // refresh 는 **1회뿐**이다 — 같은 refresh token 을 다시 보내도 판정이 같다(D-010).
      expect(log.filter((entry) => entry === 'refresh:wiki')).toHaveLength(1)
      expect(loginsOf(log, 'wiki')).toEqual(['login:wiki:1', 'login:wiki:2', 'login:wiki:3'])
    }
  )

  it('refresh 가 던져도 그 Auth 는 재로그인으로 이어지고 다음 Auth 도 산다', async () => {
    const logger = vi.fn<(event: string, data: Record<string, unknown>) => void>()
    const { auth, log, broadcast } = fakeRuntime({
      a: stale({ refresh: 'throws', logins: ['done'] }),
      b: stale({ refresh: 'refreshed' })
    })
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
    expect(log).toContain('refresh:b')
    expect(logger).toHaveBeenCalledWith('auth.resume.refresh.threw', {
      authId: 'a',
      reason: 'refresh exploded: a'
    })
  })

  it('강등되지 않은 Auth 에는 refresh 도 부르지 않는다', async () => {
    const { auth, log, broadcast } = fakeRuntime({ wiki: restored(true) })
    await createAuthResume({
      auth,
      gateDefinitions: [],
      remainingDefinitions: [session('wiki')],
      pushConnectionState: broadcast
    }).run()

    expect(log).not.toContain('refresh:wiki')
  })

  it('gate Auth 는 refresh 대상도 아니다', async () => {
    const { auth, log, broadcast } = fakeRuntime({ sso: demoted(['done']) })
    await createAuthResume({
      auth,
      gateDefinitions: [session('sso')],
      remainingDefinitions: [],
      pushConnectionState: broadcast
    }).run()

    expect(log).not.toContain('refresh:sso')
  })
})

describe('createAuthResume — resuming (0194)', () => {
  const remaining = (id: string): AuthDefinition => session(id)

  it('게이트가 열린 그 change 에서 이미 참이다 — 구독자 등록 순서와 무관하다', async () => {
    // 실제 배선에는 구독자가 둘이다(방송 · 배치 시작). 파생값이 아니라 플래그였다면 순서에
    // 정답이 생기고, 뒤집히면 `{passed:true, resuming:false}` 가 한 번 나가 메인 셸이 뜬다.
    for (const recorderFirst of [true, false]) {
      const { auth, broadcast } = fakeRuntime({ sso: restored(true), wiki: restored(true) })
      const handle = createAuthResume({
        auth,
        gateDefinitions: [session('sso')],
        remainingDefinitions: [remaining('wiki')],
        pushConnectionState: broadcast
      })
      const seen: boolean[] = []
      const recorder = (): void => void seen.push(handle.resuming())
      if (recorderFirst) {
        auth.subscribe(recorder)
        auth.subscribe((change) => {
          if (change.kind === 'snapshot') handle.onGateChange(change.authId)
        })
      } else {
        auth.subscribe((change) => {
          if (change.kind === 'snapshot') handle.onGateChange(change.authId)
        })
        auth.subscribe(recorder)
      }
      await handle.run()

      expect(seen.length).toBeGreaterThan(0)
      expect(seen.every(Boolean)).toBe(true)
    }
  })

  it('배치가 끝나면 거둬진다 — 성공·회복·후보 0건 전부', async () => {
    for (const initial of [
      { wiki: restored(true) },
      { wiki: demoted(['done']) },
      { wiki: { status: 'none', verified: false, probeOk: true } as FakeState }
    ]) {
      const { auth, broadcast } = fakeRuntime(initial)
      const handle = createAuthResume({
        auth,
        gateDefinitions: [],
        remainingDefinitions: [remaining('wiki')],
        pushConnectionState: broadcast
      })
      await handle.run()

      expect(handle.resuming()).toBe(false)
    }
  })

  it('배치가 예외로 끝나도 거둬진다 — 대기 화면에 영구히 잠기지 않는다', async () => {
    const broadcast = vi.fn<() => void>()
    const exploding = {
      tryBind: () => {
        throw new Error('store exploded')
      },
      subscribe: () => () => undefined
    } as unknown as AuthRuntime
    const handle = createAuthResume({
      auth: exploding,
      gateDefinitions: [],
      remainingDefinitions: [remaining('wiki')],
      pushConnectionState: broadcast
    })

    await expect(handle.run()).rejects.toThrow('store exploded')
    // `finally` 가 없으면 여기가 true 로 굳고 앱이 스피너에서 나오지 못한다.
    expect(handle.resuming()).toBe(false)
    expect(broadcast).toHaveBeenCalledTimes(1)
  })

  it('게이트가 열리지 않았으면 거짓이다 — 우회로 통과한 빌드가 잠기지 않는다', async () => {
    // `gateOpen()` 은 bypass 를 보지 않는다. 우회로 `passed:true` 가 된 빌드는 gate 선언이
    // 미검증이라 배치를 아예 돌리지 않으므로, 여기서 참이면 그 빌드가 영영 못 들어온다.
    const { auth, broadcast } = fakeRuntime({ sso: restored(false), wiki: restored(true) })
    const handle = createAuthResume({
      auth,
      gateDefinitions: [session('sso')],
      remainingDefinitions: [remaining('wiki')],
      pushConnectionState: broadcast
    })
    await handle.run()

    expect(handle.resuming()).toBe(false)
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
