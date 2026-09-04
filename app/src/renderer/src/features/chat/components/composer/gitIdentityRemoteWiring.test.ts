// 0211 라운드 5 — D35 / VP-100·VP-102 · §10 EP-74 ① · EP-76 ③.
//
// `gitIdentityRemote.test.ts` 는 **팩토리**(`createGitIdentityRemoteCache`)만 잰다. 그래서
// 훅의 `void cache.ensure()` 를 지워도(M41), GitRow 의 갱신 세대를 상수로 만들어도(M8)
// 3,324 케이스가 전부 초록이었다 — 메뉴가 영영 `loading` 이어도 게이트가 조용했다.
//
// 여기서는 두 배선을 각각 잰다.
//   ① 훅 자신 — 메뉴가 열리면 `gitApi.status` 를 **몇 번** 부르는가(EP-74 ①).
//   ② GitRow → GitRowView — 갱신 세대가 메뉴 owner 의 key 에 닿는가(EP-76 ③).
//
// 이 파일이 ① 이고, ② 는 형제 `gitRowIdentityGeneration.test.ts` 다.
//
// vitest 가 `environment: 'node'` 라 effect 를 돌릴 DOM 이 없다. 형제
// `hooks/useGitPatch.commitScope.test.ts` 와 같은 방식으로 react 훅을 대역으로 세워
// **프로덕션 훅 자신**을 돌린다(신규 의존성 0).

import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Slot {
  deps: unknown[]
  value?: unknown
  cleanup?: void | (() => void)
}

const h = vi.hoisted(() => ({
  status: vi.fn(),
  memo: [] as Slot[],
  effect: [] as Slot[],
  cursor: { memo: 0, effect: 0 },
  pending: [] as (() => void)[]
}))

const sameDeps = (a: unknown[] | undefined, b: unknown[]): boolean =>
  a !== undefined && a.length === b.length && a.every((dep, index) => Object.is(dep, b[index]))

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useMemo: (factory: () => unknown, deps: unknown[]) => {
    const index = h.cursor.memo++
    const slot = h.memo[index]
    if (!sameDeps(slot?.deps, deps)) h.memo[index] = { deps, value: factory() }
    return h.memo[index].value
  },
  useEffect: (run: () => void | (() => void), deps: unknown[]) => {
    const index = h.cursor.effect++
    const slot = h.effect[index]
    if (sameDeps(slot?.deps, deps)) return
    h.pending.push(() => {
      slot?.cleanup?.()
      h.effect[index] = { deps, cleanup: run() }
    })
  },
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot()
}))
vi.mock('../../../../shared/api/ipc', () => ({ gitApi: { status: h.status } }))

import { useGitIdentityRemote, type GitIdentityRemote } from './useGitIdentityRemote'

const URL = 'https://company.github.com/owner/repo'

// 훅 호출은 컴포넌트 이름의 함수 안에 둔다(react-hooks/rules-of-hooks) — 형제
// `hooks/useGitPatch.commitScope.test.ts` 의 `HookProbe` 와 같은 형태다.
function RemoteProbe(
  cwd: string | null,
  menuEpoch: number | undefined,
  fallback: string | null
): GitIdentityRemote {
  return useGitIdentityRemote(cwd, menuEpoch, fallback)
}

/** 한 번의 렌더 + effect flush. 훅 슬롯은 남으므로 재호출이 리렌더다. */
function renderRemote(
  cwd: string | null,
  menuEpoch: number | undefined,
  fallback: string | null = null
): GitIdentityRemote {
  h.cursor.memo = 0
  h.cursor.effect = 0
  const remote = RemoteProbe(cwd, menuEpoch, fallback)
  for (const run of h.pending.splice(0)) run()
  return remote
}

/** `ensure()` 는 load 를 마이크로태스크에 건다 — 호출 수를 세기 전에 그 틱을 넘긴다. */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** key 가 바뀌어 owner 가 갈리는 것 — 슬롯을 버린다. */
function remount(): void {
  for (const slot of h.effect) slot?.cleanup?.()
  h.memo = []
  h.effect = []
  h.pending = []
}

beforeEach(() => {
  remount()
  h.status.mockReset()
  h.status.mockResolvedValue({ githubUrl: URL })
})

describe('메뉴 원격 조회 배선 (D35 · VP-102 · EP-74 ①)', () => {
  it('메뉴를 열면 현재 cwd 로 조회하고 결과가 메뉴 상태가 된다', async () => {
    expect(renderRemote('/repo', undefined).phase).toBe('loading')
    // 아직 안 열었다 — 열지 않은 메뉴가 조회하면 여기서 red 다.
    expect(h.status).not.toHaveBeenCalled()

    renderRemote('/repo', 1)
    await tick()
    expect(h.status).toHaveBeenCalledExactlyOnceWith('/repo')

    await vi.waitFor(() => expect(renderRemote('/repo', 1)).toEqual({ phase: 'ready', url: URL }))
  })

  it('닫았다 다시 열어도 같은 owner 면 조회가 늘지 않는다', async () => {
    renderRemote('/repo', 1)
    await vi.waitFor(() => expect(renderRemote('/repo', 1).phase).toBe('ready'))

    renderRemote('/repo', 2)
    renderRemote('/repo', 3)

    expect(h.status).toHaveBeenCalledTimes(1)
  })

  it('턴 종료·새로 고침이 owner 를 갈면 다시 조회한다', async () => {
    renderRemote('/repo', 1)
    await vi.waitFor(() => expect(renderRemote('/repo', 1).phase).toBe('ready'))

    // 갱신 세대가 바뀌면 GitRow 의 key 가 바뀌어 메뉴가 새 owner 로 다시 선다.
    remount()
    renderRemote('/repo', 1)
    await tick()

    expect(h.status).toHaveBeenCalledTimes(2)
  })

  it('작업 경로가 바뀌면 이전 결과를 물려주지 않는다', async () => {
    renderRemote('/repo', 1)
    await vi.waitFor(() => expect(renderRemote('/repo', 1).phase).toBe('ready'))

    h.status.mockResolvedValue({ githubUrl: null })
    expect(renderRemote('/other', 1).phase).toBe('loading')
    await tick()

    expect(h.status).toHaveBeenNthCalledWith(2, '/other')
    await vi.waitFor(() =>
      expect(renderRemote('/other', 1)).toEqual({ phase: 'unavailable', url: null })
    )
  })

  it('실패는 다음 열기에서 재시도한다 — error 로 고착되지 않는다', async () => {
    h.status.mockRejectedValueOnce(new Error('boom'))
    renderRemote('/repo', 1)
    await vi.waitFor(() => expect(renderRemote('/repo', 1).phase).toBe('error'))

    renderRemote('/repo', 2)
    await tick()
    expect(h.status).toHaveBeenCalledTimes(2)
    await vi.waitFor(() => expect(renderRemote('/repo', 2)).toEqual({ phase: 'ready', url: URL }))
  })

  it('랜딩(cwd 없음)에서는 조회하지 않고 전달받은 주소를 그대로 쓴다', () => {
    expect(renderRemote(null, 1, URL)).toEqual({ phase: 'ready', url: URL })
    expect(renderRemote(null, 2, null)).toEqual({ phase: 'unavailable', url: null })
    expect(h.status).not.toHaveBeenCalled()
  })
})
