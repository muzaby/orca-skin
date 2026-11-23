import { createElement } from 'react'
import { it, expect, vi } from 'vitest'
import { revisionOf } from '../../../../../shared/compute/documents'
import { WorkToolBody } from './WorkToolBody'
import {
  dom,
  fake,
  useTestVirtualRows
} from '../../../../../shared/ui/virtual/virtualView.testfixture'
import type { RefObject } from 'react'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => ':fixture:'
}))
vi.mock('../../../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key }),
  i18n: { t: (key: string) => key }
}))
const observations = vi.hoisted(() => ({ owners: [] as RefObject<HTMLDivElement | null>[] }))
vi.mock('../../../../../shared/ui/virtual/useVirtualRows', () => ({
  useVirtualRows: (count: number, _: unknown, owner: RefObject<HTMLDivElement | null>) => {
    observations.owners.push(owner)
    return useTestVirtualRows(count)
  }
}))
const source = Array.from({ length: 501 }, (_, i) => 'row ' + i).join('\n')
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 테스트 하네스의 반환형은 조립한 fixture에서 추론한다.
function mount(name = 'Fixture') {
  observations.owners = []
  const open = vi.spyOn(fake.client, 'openDocument')
  const input = [{ type: 'text', text: source }],
    result = { isError: true, output: source + ' updated' }
  const render = (complete = false): void =>
    dom.render(
      createElement(WorkToolBody, {
        call: { name, toolUseId: 'tool', input, result: complete ? result : undefined }
      })
    )
  render()
  return { open, render, input, result, owner: () => dom.query('[data-work-tool-body]')! }
}
it('wk1 running request uses the single Work scroll owner', () => {
  const v = mount()
  expect(dom.queryAll('[data-virtual-code]')).toHaveLength(1)
  expect(observations.owners.at(-1)?.current).toBe(v.owner())
})
it('wk2 request and response share their scroll owner', () => {
  const v = mount()
  v.render(true)
  expect(dom.queryAll('[data-virtual-code]')).toHaveLength(2)
  expect(observations.owners.every((ref) => ref.current === (v.owner() as unknown))).toBe(true)
})
it('wk3 response arrival retains the request lease and scroll position', () => {
  const v = mount()
  v.owner().scrollTop = 60
  v.render(true)
  expect(v.open.mock.calls.map(([ref]) => ref.id)).toEqual([
    'tool:tool:work:request',
    'tool:tool:work:response'
  ])
  expect(v.owner().scrollTop).toBe(60)
})
it.each(['Fixture', 'TaskUpdate'])(
  'wk4 %s rerenders retain independent request and response revisions',
  (name) => {
    const v = mount(name)
    v.render(true)
    const ids = v.open.mock.calls.map(([ref]) => ref)
    for (let i = 0; i < 10; i++) v.render(true)
    expect(v.open.mock.calls.map(([ref]) => ref)).toEqual(ids)
    expect(ids.map((ref) => ref.revision)).toEqual([revisionOf(v.input), revisionOf(v.result)])
  }
)
