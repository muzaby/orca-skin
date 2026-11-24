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
const responseCases = [
  { name: 'Fixture', details: false },
  { name: 'TaskUpdate', details: true },
  { name: 'WebSearch', details: true }
]
const source = Array.from({ length: 501 }, (_, i) => 'row ' + i).join('\n')
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 테스트 하네스의 반환형은 조립한 fixture에서 추론한다.
function mount(name = 'Fixture') {
  observations.owners = []
  const open = vi.spyOn(fake.client, 'openDocument')
  const input = [{ type: 'text', text: source }]
  const output =
    name === 'WebSearch'
      ? source + '\nLinks: [{"title":"Example","url":"https://example.org"}]'
      : source + ' updated'
  const result = { isError: false, output }
  const render = (response?: typeof result): void =>
    dom.render(
      createElement(WorkToolBody, {
        call: { name, toolUseId: 'tool', input, result: response }
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
it.each(responseCases)(
  'wk2 $name request and response share their scroll owner',
  ({ name, details }) => {
    const v = mount(name)
    v.render(v.result)
    expect(dom.queryAll('[data-virtual-code]')).toHaveLength(2)
    const response = dom.queryAll('[data-virtual-code]')[1]
    expect(response.path.some((node) => node.tag === 'details')).toBe(details)
    expect(v.owner().props.className).toContain('max-h-[250px]')
    for (const list of dom.queryAll('[data-virtual-code]')) {
      for (
        let wrapper = list.parentElement;
        wrapper && wrapper !== v.owner();
        wrapper = wrapper.parentElement
      )
        expect(String(wrapper.props.className)).not.toMatch(
          /(?:^|\s)(?:max-h-|overflow-(?:auto|scroll))/
        )
    }
    expect(observations.owners.every((ref) => ref.current === (v.owner() as unknown))).toBe(true)
  }
)
it.each(responseCases)(
  'wk3 $name response arrival retains the request lease and scroll position',
  ({ name }) => {
    const v = mount(name)
    v.owner().scrollTop = 60
    v.render(v.result)
    expect(v.open.mock.calls.map(([ref]) => ref.id)).toEqual([
      'tool:tool:work:request',
      'tool:tool:work:response'
    ])
    expect(v.owner().scrollTop).toBe(60)
  }
)
it.each(responseCases)(
  'wk4 $name rerenders retain independent request and response revisions',
  ({ name }) => {
    const v = mount(name)
    v.render(v.result)
    for (let i = 0; i < 10; i++) v.render(v.result)
    const updated = { ...v.result, output: v.result.output + '\nUpdated' }
    v.render(updated)
    expect(v.open.mock.calls.map(([ref]) => ref)).toEqual([
      { id: 'tool:tool:work:request', revision: revisionOf(v.input) },
      { id: 'tool:tool:work:response', revision: revisionOf(v.result) },
      { id: 'tool:tool:work:response', revision: revisionOf(updated) }
    ])
  }
)
