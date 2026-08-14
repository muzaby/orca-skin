// 부팅 Auth 복원 순서와 방송 상한 (0188 — 구 `LoginService` sweep 테스트의 이식).
//
// 0181 은 순서·병렬성·통지 합치기를 `LoginService` 안에 뒀고 그 테스트도 거기 있었다.
// 0188 이 그 정책을 app 레이어로 옮겼으므로 검증도 따라온다 — **같은 행동을 계속 단언한다**:
// 게이트 우선 · 나머지 병렬 · 실패 즉시 통지 · 성공 batch 는 마지막 1회.

import { describe, expect, it, vi } from 'vitest'
import type {
  AuthChange,
  AuthDefinition,
  AuthId,
  AuthRuntime,
  AuthSnapshot,
  BoundAuth
} from '../contracts/auth'
import { createAuthResume, gateOpen } from './auth-resume'

function definition(id: string, withProbe = true): AuthDefinition {
  return {
    id,
    label: id,
    origin: `https://${id}.example.corp`,
    methods: [],
    ...(withProbe ? { probe: { path: '/api/me' } } : {})
  }
}

interface FakeState {
  status: AuthSnapshot['status']
  verified: boolean
  probeOk: boolean
}

// 실제 `AuthRuntime` 을 흉내내되 **순서를 관측할 수 있게** 한다: resume 진입/이탈을 로그에
// 남기고, 나머지 batch 의 병렬성은 "모두 진입한 뒤에야 첫 이탈이 일어나는가" 로 본다.
function fakeRuntime(
  initial: Record<string, FakeState>,
  hold: readonly string[] = []
): {
  auth: AuthRuntime
  log: string[]
  release: (id: string) => void
  broadcast: ReturnType<typeof vi.fn<() => void>>
} {
  const states = new Map(Object.entries(initial))
  const log: string[] = []
  // `release()` 로 완료 시점을 제어할 대상. 병렬성 관측에만 쓴다.
  const gates = new Map<string, (() => void) | null>()
  for (const id of hold) gates.set(id, null)
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
    login: () => Promise.reject(new Error('not used')),
    continue: () => Promise.reject(new Error('not used')),
    reauth: () => Promise.reject(new Error('not used')),
    revoke: () => undefined
  }

  return { auth, log, release: (id) => gates.get(id)?.(), broadcast }
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
