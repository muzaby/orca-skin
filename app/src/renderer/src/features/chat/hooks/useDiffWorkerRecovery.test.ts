import { createElement } from 'react'
import { expect, it, vi } from 'vitest'
import type { DiffOptions, DiffSourceRef } from '../../../shared/compute/diffSource'
import { dom, fake, settle } from '../../../shared/ui/virtual/virtualView.testfixture'
import { useDiffAnchor, useDiffContext } from './useDiffAnchor'
import { useDiffLines } from './useDiffLines'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))

const oldText = 'old\n'.repeat(5000)
const newText = 'new\n'.repeat(5000)
const source: DiffSourceRef = { kind: 'patch', doc: { id: 'recovery-patch', revision: 1 } }
const options: DiffOptions = {
  layout: 'inline',
  ignoreWhitespace: false,
  highlightWords: false,
  expansions: []
}

it('AC20 restores failed diff lines once after compute recovery', async () => {
  function Probe(): React.JSX.Element {
    const result = useDiffLines(oldText, newText)
    return createElement(
      'span',
      null,
      result.status === 'ready' ? result.lines[0].text : result.status
    )
  }
  dom.render(createElement(Probe))
  expect(fake.requests.map((request) => request.kind)).toEqual(['diffLines'])
  fake.rejectNext()
  await settle()
  expect(dom.body.textContent).toBe('failed')
  fake.recover('markdown')
  await settle()
  expect(fake.requests).toHaveLength(1)
  fake.recover('compute')
  await settle()
  expect(fake.requests).toHaveLength(2)
  fake.resolveNext({
    lines: [{ oldLine: null, newLine: 1, lineNo: 1, type: 'added', text: 'new' }]
  })
  await settle()
  expect(dom.body.textContent).toBe('new')
  fake.recover('compute')
  await settle()
  expect(fake.requests).toHaveLength(2)
})

it('AC20 restores the missing diff anchor and context once after compute recovery', async () => {
  function Probe(): React.JSX.Element {
    const location = useDiffAnchor(source, options, null, { oldLine: null, newLine: 8 }, true)
    const context = useDiffContext(source, false, null, 8, true)
    return createElement(
      'span',
      null,
      (location?.rowIndex[0] ?? 'no row') + '/' + (context?.offset ?? 'no context')
    )
  }
  dom.render(createElement(Probe))
  expect(fake.requests.map((request) => request.kind)).toEqual(['diffLocate', 'diffContext'])
  fake.rejectNext()
  fake.rejectNext()
  await settle()
  expect(dom.body.textContent).toBe('no row/no context')
  expect(fake.requests).toHaveLength(2)
  fake.recover('compute')
  await settle()
  expect(fake.requests.map((request) => request.kind)).toEqual([
    'diffLocate',
    'diffContext',
    'diffLocate',
    'diffContext'
  ])
  fake.resolveNext({ rowIndex: [5], lineIndex: [8] })
  fake.resolveNext({ lines: [], offset: 3, oldBefore: 1, newBefore: 2 })
  await settle()
  expect(dom.body.textContent).toBe('5/3')
  fake.recover('compute')
  await settle()
  expect(fake.requests).toHaveLength(4)
})
