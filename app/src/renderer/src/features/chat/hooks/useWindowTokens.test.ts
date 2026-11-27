import { createElement } from 'react'
import { afterEach, it, expect, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../shared/ui/renderHarness.testfixture'
import type { TokenRows, TokensRequest } from '../../../shared/compute/protocol'
import { setComputeClient, type Priority } from '../../../shared/compute/client'
import { fakeComputeClient } from '../../../shared/compute/fakeClient.testfixture'
import { useWindowTokens } from './useWindowTokens'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
const env = vi.hoisted(() => ({ request: vi.fn(), theme: 'github-light' }))
vi.mock('../../../shared/ui/markdown/themeStore', () => ({
  getThemeSnapshot: () => env.theme,
  subscribeTheme: () => () => {}
}))
let dom: FakeDom
afterEach(() => {
  dom.unmount()
  setComputeClient(null)
  vi.unstubAllGlobals()
  env.request.mockReset()
  env.theme = 'github-light'
})
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 테스트 하네스의 반환형은 조립한 fixture에서 추론한다.
function fixture() {
  setComputeClient({ ...fakeComputeClient().client, request: env.request })
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
  const tasks: {
    resolve: (r: { rows: TokenRows }) => void
    cancel: ReturnType<typeof vi.fn>
    setPriority: ReturnType<typeof vi.fn>
  }[] = []
  env.request.mockImplementation(() => {
    let resolve!: (r: { rows: TokenRows }) => void
    const promise = new Promise<{ rows: TokenRows }>((r) => {
      resolve = r
    })
    const task = { promise, resolve, cancel: vi.fn(), setPriority: vi.fn() }
    tasks.push(task)
    return task
  })
  const sources = [1, 2].map((revision) => ({ doc: { id: 'file', revision } }))
  let output: TokenRows | undefined
  function Probe({
    rev,
    start,
    priority,
    enabled
  }: {
    rev: number
    start: number
    priority: Priority
    enabled: boolean
  }): null {
    output = useWindowTokens(sources[rev - 1], 'typescript', start, priority, enabled)
    return null
  }
  const render = (rev = 1, start = 0, priority: Priority = 'visible', enabled = true): void =>
    dom.render(createElement(Probe, { rev, start, priority, enabled }))
  const requested = (): TokensRequest => env.request.mock.calls.at(-1)![0]
  return { tasks, render, requested, output: () => output }
}
it('wt1 requests one bounded aligned window', () => {
  const v = fixture()
  v.render(1, 200)
  expect(v.requested()).toMatchObject({
    start: 200,
    end: 400,
    kind: 'tokens',
    doc: { id: 'file', revision: 1 }
  })
})
it('wt2 respects initial background priority', () => {
  const v = fixture()
  v.render(1, 0, 'background')
  expect(env.request.mock.calls[0][1]).toEqual({ priority: 'background' })
})
it('wt3 disables and cancels the previous subscription', () => {
  const v = fixture()
  v.render()
  v.render(1, 0, 'visible', false)
  expect(env.request).toHaveBeenCalledTimes(1)
  expect(v.tasks[0].cancel).toHaveBeenCalledOnce()
})
it.each(['revision', 'theme', 'window'])(
  'wt4 ignores late results after changing %s',
  async (axis) => {
    const v = fixture()
    v.render()
    const revision = axis === 'revision' ? 2 : 1,
      start = axis === 'window' ? 200 : 0
    if (axis === 'theme') env.theme = 'github-dark'
    v.render(revision, start)
    expect(v.tasks).toHaveLength(2)
    v.tasks[0].resolve({ rows: [[]] })
    await Promise.resolve()
    v.render(revision, start)
    expect(v.output()).toBeUndefined()
    const fresh = [[], []]
    v.tasks[1].resolve({ rows: fresh })
    await Promise.resolve()
    v.render(revision, start)
    expect(v.output()).toBe(fresh)
    // A previously committed result must also disappear on the first render of the next key.
    v.render(revision, start + 400)
    expect(v.output()).toBeUndefined()
  }
)
it('wt5 promotes and demotes without starting a new request', () => {
  const v = fixture()
  v.render(1, 0, 'background')
  v.render()
  v.render(1, 0, 'background')
  expect(v.tasks[0].setPriority.mock.calls).toEqual([['visible'], ['background']])
  expect(env.request).toHaveBeenCalledOnce()
})
