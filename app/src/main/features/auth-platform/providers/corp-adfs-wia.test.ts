// ADFS/WIA provider (0174) — probe 실패의 **방향**이 자리마다 다르다.
//
// 실기에서 로그인이 막힌 지점이 정확히 여기였다: 창은 완료됐는데 확인 probe 가 실패해
// `invalid_credentials` 로 끝났다. 이 스위트가 그 두 자리를 갈라 고정한다.

import { describe, expect, it, vi } from 'vitest'
import { createAdfsWiaProvider } from './corp-adfs-wia'
import type { AuthPluginContext, BrowserProbeResult } from '../../../contracts/auth-plugin'

const ORIGIN = 'https://adfs.corp.invalid'

function provider(): ReturnType<typeof createAdfsWiaProvider> {
  return createAdfsWiaProvider({
    id: 'adfs',
    pluginId: 'corp',
    label: 'ADFS',
    sessionGroup: 'corp-adfs',
    loginUrl: `${ORIGIN}/login`,
    doneUrlPrefix: `${ORIGIN}/home`,
    authenticationProbeUrl: `${ORIGIN}/me`,
    allowedOrigins: [ORIGIN]
  })
}

interface Harness {
  ctx: AuthPluginContext
  opened: number
  probes: number
  logs: string[]
}

// probe 결과를 호출 순서대로 준다 — 1번째 = 창 앞(세션 재사용 판정), 2번째 = 창 뒤(확인).
function harness(results: Array<BrowserProbeResult | Error>): Harness {
  const state = { opened: 0, probes: 0 }
  const logs: string[] = []
  const ctx = {
    target: { kind: 'application', applicationId: 'orca' },
    input: {},
    signal: new AbortController().signal,
    vault: {
      get: () => null,
      set: () => undefined,
      delete: () => undefined,
      describe: () => null
    },
    browserSessions: {
      acquire: async () => 'handle:corp-adfs',
      openLoginWindow: async () => {
        state.opened += 1
        return { finalUrl: `${ORIGIN}/home` }
      },
      probe: async () => {
        const next = results[state.probes] ?? { ok: false, status: 302, finalUrl: ORIGIN }
        state.probes += 1
        if (next instanceof Error) throw next
        return next
      },
      clear: async () => undefined
    },
    fetch: async () => new Response('{}', { status: 200 }),
    exec: async () => ({ code: 0, stdout: '', stderr: '' }),
    store: { get: () => undefined, set: () => undefined },
    env: () => undefined,
    logger: (message: string) => void logs.push(message),
    clock: () => 1_700_000_000_000
  } as unknown as AuthPluginContext

  return {
    ctx,
    get opened() {
      return state.opened
    },
    get probes() {
      return state.probes
    },
    logs
  }
}

const AUTHENTICATED: BrowserProbeResult = { ok: true, status: 200, finalUrl: `${ORIGIN}/me` }
// 실기에서 관측된 형상: 인증됐는데도 302 로 로그인 URL 을 가리킨다.
const REDIRECTED: BrowserProbeResult = { ok: false, status: 302, finalUrl: `${ORIGIN}/login` }

describe('창을 띄우기 전 — probe 판정을 그대로 신뢰한다', () => {
  it('세션이 살아 있으면 창을 열지 않고 바로 binding 을 만든다 (AUTH-PLAT-006)', async () => {
    const h = harness([AUTHENTICATED])
    const step = await provider().begin(h.ctx)

    expect(step.kind).toBe('done')
    expect(h.opened).toBe(0)
  })

  it('세션이 없으면 창을 연다 — 오판의 대가는 "창이 한 번 더 뜬다" 뿐이다', async () => {
    const h = harness([REDIRECTED, AUTHENTICATED])
    const step = await provider().begin(h.ctx)

    expect(h.opened).toBe(1)
    expect(step.kind).toBe('done')
  })
})

describe('창이 완료된 뒤 — probe 는 확인용이다 (0174)', () => {
  it('probe 가 실패해도 로그인은 성공한다 — 여기서 막으면 로그인 자체가 불가능해진다', async () => {
    // 실기 증상 그대로: 창은 doneUrlPrefix 에 도달했는데 확인 probe 가 302 를 준다.
    const h = harness([REDIRECTED, REDIRECTED])
    const step = await provider().begin(h.ctx)

    expect(step.kind).toBe('done')
    if (step.kind !== 'done') throw new Error('unreachable')
    expect(step.binding.mechanism).toBe('adfs_browser_session')
    expect(step.binding.artifact).toMatchObject({
      kind: 'browser_session',
      sessionGroup: 'corp-adfs'
    })
    // 조용히 넘어가지 않는다 — 왜 확인이 안 됐는지 로그로 남는다.
    expect(h.logs.join()).toMatch(/probe/)
  })

  it('probe 가 예외를 던져도 로그인은 성공한다', async () => {
    const h = harness([REDIRECTED, new Error('요청이 취소되었습니다')])
    const step = await provider().begin(h.ctx)

    expect(step.kind).toBe('done')
    expect(h.logs.join()).toMatch(/probe/)
  })

  it('창이 실패하면 로그인도 실패한다 — 완료 신호가 없으면 만들 근거가 없다', async () => {
    const h = harness([REDIRECTED])
    const failing = createAdfsWiaProvider({
      id: 'adfs',
      pluginId: 'corp',
      label: 'ADFS',
      sessionGroup: 'corp-adfs',
      loginUrl: `${ORIGIN}/login`,
      doneUrlPrefix: `${ORIGIN}/home`,
      authenticationProbeUrl: `${ORIGIN}/me`,
      allowedOrigins: [ORIGIN]
    })
    h.ctx.browserSessions.openLoginWindow = vi.fn(async () => {
      throw new Error('사용자가 로그인 창을 닫았습니다')
    })

    const step = await failing.begin(h.ctx)
    expect(step.kind).toBe('failed')
    if (step.kind !== 'failed') throw new Error('unreachable')
    expect(step.reason).toBe('cancelled')
  })
})
