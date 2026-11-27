// diff 계산 훅 (0324 AC9·AC10) — 토큰은 워커 결과를 축별로 줄에 붙이고, 줄 계산은 상한 이하면
// 같은 렌더에서, 넘으면 워커 결과가 올 때까지 로딩이다. 계산 클라이언트는 가짜를 넣는다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
import { createElement, useLayoutEffect } from 'react'
import { setComputeClient } from '../../../shared/compute/client'
import { fakeComputeClient, type FakeCompute } from '../../../shared/compute/fakeClient.testfixture'
import { installFakeDom, type FakeDom } from '../../../shared/ui/renderHarness.testfixture'
import type { DiffLine } from '../lib/diffLines'
import { useDiffLines, type DiffLinesState } from './useDiffLines'
import { useDiffSyntax } from './useDiffSyntax'

let dom: FakeDom
let compute: FakeCompute

beforeEach(() => {
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
  compute = fakeComputeClient()
  setComputeClient(compute.client)
})
afterEach(() => {
  dom.unmount()
  setComputeClient(null)
  vi.unstubAllGlobals()
})
async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve()
  dom.act(() => {})
}
const linesOf = (count: number, prefix: string): string =>
  Array.from({ length: count }, (_, i) => `${prefix}${i}`).join('\n')

describe('useDiffLines', () => {
  let state: DiffLinesState
  function Probe({ oldValue, newValue }: { oldValue: string; newValue: string }): null {
    const result = useDiffLines(oldValue, newValue)
    useLayoutEffect(() => {
      state = result
    }, [result])
    return null
  }
  const render = (oldValue: string, newValue: string): void =>
    dom.render(createElement(Probe, { oldValue, newValue }))

  it('줄 수 합 400 이하는 같은 렌더에서 결과가 나오고 워커에 요청하지 않는다', () => {
    render(linesOf(200, 'a'), linesOf(200, 'b'))
    expect(state.status).toBe('ready')
    expect(state.status === 'ready' && state.lines).toHaveLength(400)
    expect(compute.requests).toEqual([])
  })

  it('줄 수 합 401 은 워커 결과가 올 때까지 로딩이다', async () => {
    const oldValue = linesOf(200, 'a')
    const newValue = linesOf(201, 'b')
    render(oldValue, newValue)
    expect(state).toEqual({ status: 'loading' })
    expect(compute.requests).toEqual([{ kind: 'diffLines', oldValue, newValue }])

    const lines: DiffLine[] = [{ type: 'added', oldLine: null, newLine: 1, lineNo: 1, text: 'w' }]
    compute.resolveNext({ lines })
    await settle()
    expect(state).toEqual({ status: 'ready', lines })
  })

  // 0325 VP-14 — 줄 수가 작아도 문자 합이 상한을 넘으면 워커로 간다.
  it('routes a 64,001-char single-line pair to the worker', () => {
    const oldValue = 'a'.repeat(32_000)
    const newValue = 'b'.repeat(32_001)
    render(oldValue, newValue)
    expect(state).toEqual({ status: 'loading' })
    expect(compute.requests).toEqual([{ kind: 'diffLines', oldValue, newValue }])
  })

  it('워커가 실패하면 failed 다 — UI 스레드에서 대신 계산하지 않는다', async () => {
    render(linesOf(401, 'a'), '')
    compute.rejectNext()
    await settle()
    expect(state).toEqual({ status: 'failed' })
  })

  it('입력이 바뀌면 앞 요청을 취소하고 새 입력은 다시 로딩이다', async () => {
    render(linesOf(401, 'a'), '')
    render(linesOf(401, 'b'), '')
    expect(compute.cancelled).toHaveLength(1)
    expect(state).toEqual({ status: 'loading' })
    compute.resolveNext({ lines: [] })
    await settle()
    expect(state).toEqual({ status: 'ready', lines: [] })
  })

  it('큰 입력에서 작은 입력으로 바뀌면 곧바로 UI 스레드 결과다', () => {
    render(linesOf(401, 'a'), '')
    render('a\n', 'b\n')
    expect(state.status === 'ready' && state.lines.map((l) => l.type)).toEqual(['removed', 'added'])
  })
})

describe('useDiffSyntax', () => {
  const lines: DiffLine[] = [
    { type: 'removed', oldLine: 1, newLine: null, lineNo: 1, text: 'const old = 1' },
    { type: 'added', oldLine: null, newLine: 1, lineNo: 1, text: 'const next = 2' },
    { type: 'unchanged', oldLine: 2, newLine: 2, lineNo: 2, text: 'done()' }
  ]
  const token = (
    content: string,
    color: string
  ): { content: string; color: string; offset: number } => ({ content, color, offset: 0 })
  let tokens: ReturnType<typeof useDiffSyntax>
  function Probe({ value, path }: { value: readonly DiffLine[]; path: string }): null {
    const result = useDiffSyntax(value, path)
    useLayoutEffect(() => {
      tokens = result
    }, [result])
    return null
  }
  const render = (value: readonly DiffLine[], path: string): void =>
    dom.render(createElement(Probe, { value, path }))

  it('가짜 클라이언트가 준 토큰이 old/new 축별로 해당 줄에 붙는다', async () => {
    render(lines, 'src/a.ts')
    expect(tokens.size).toBe(0)
    expect(compute.requests).toEqual([
      {
        kind: 'diffTokens',
        oldText: 'const old = 1\ndone()',
        newText: 'const next = 2\ndone()',
        lang: 'typescript',
        theme: 'github-light'
      }
    ])
    compute.resolveNext({
      old: [[token('const old = 1', 'o0')], [token('done()', 'o1')]],
      new: [[token('const next = 2', 'n0')], [token('done()', 'n1')]]
    })
    await settle()
    expect(tokens.get(lines[0])).toEqual({ old: [token('const old = 1', 'o0')] })
    expect(tokens.get(lines[1])).toEqual({ new: [token('const next = 2', 'n0')] })
    expect(tokens.get(lines[2])).toEqual({
      old: [token('done()', 'o1')],
      new: [token('done()', 'n1')]
    })
  })

  it('AC20 restores diff syntax after recovery', async () => {
    render(lines, 'src/a.ts')
    compute.rejectNext()
    await settle()
    expect(tokens.size).toBe(0)
    expect(compute.requests).toHaveLength(1)
    compute.recover('compute')
    await settle()
    expect(compute.requests).toHaveLength(2)
    compute.resolveNext({
      old: [[token('const old = 1', 'orange')]],
      new: [[token('const next = 2', 'blue')]]
    })
    await settle()
    expect(tokens.get(lines[0])?.old?.[0].color).toBe('orange')
    compute.recover('compute')
    await settle()
    expect(compute.requests).toHaveLength(2)
  })
  it('지원하지 않는 확장자는 요청하지 않는다', () => {
    render(lines, 'binary.unknown')
    expect(compute.requests).toEqual([])
    expect(tokens.size).toBe(0)
  })

  it('워커가 실패하면 빈 맵이라 원문을 그린다', async () => {
    render(lines, 'src/a.ts')
    compute.rejectNext()
    await settle()
    expect(tokens.size).toBe(0)
  })

  it('줄 배열이 바뀌면 앞 요청을 취소한다', () => {
    render(lines, 'src/a.ts')
    render([lines[1]], 'src/a.ts')
    expect(compute.cancelled).toHaveLength(1)
    expect(compute.requests).toHaveLength(2)
  })
})
