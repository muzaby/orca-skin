import { createElement } from 'react'
import { expect, it, vi } from 'vitest'
import { ToolBody } from '../../opencode/transcript/ToolBody'
import { DiffBody } from '../../claude/transcript/tool-bodies/DiffBody'
import { DiffTable, PairDiffTable } from './DiffTable'
import { buildDiffView, diffViewRows } from '../../../../../shared/compute/diffView'
import { hunksToDiffLines } from '../../../../../shared/compute/diffModel'
import {
  dom,
  fake,
  settle,
  useTestVirtualRows
} from '../../../../../shared/ui/virtual/virtualView.testfixture'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => ':fixture:'
}))
vi.mock('../../../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key }),
  i18n: { t: (key: string) => key }
}))
const state = vi.hoisted(() => ({ owner: null as { current: unknown } | null }))
vi.mock('../../../../../shared/ui/virtual/useVirtualRows', () => ({
  useVirtualRows: (n: number, _: unknown, owner: { current: unknown }) => {
    state.owner = owner
    return useTestVirtualRows(n)
  }
}))
vi.mock('../../../hooks/useSmallDiffSyntax', () => ({ useSmallDiffSyntax: () => new Map() }))
const lines = (count: number): import('../../../../../shared/compute/diffModel').DiffLine[] =>
  hunksToDiffLines([
    { value: Array.from({ length: count }, (_, i) => 'line ' + i).join('\n'), added: true }
  ])
it('dt1 long table limits mounted rows', () => {
  dom.render(createElement(DiffTable, { lines: lines(5000) }))
  expect(dom.query('[data-virtual-diff]')).not.toBeNull()
  expect(dom.queryAll('[data-index]')).toHaveLength(4)
})
it('dt2 exactly 400 rows use the plain table', () => {
  dom.render(createElement(DiffTable, { lines: lines(400) }))
  expect(dom.query('[data-virtual-diff]')).toBeNull()
  expect(dom.body.textContent).toContain('line 399')
})
it('dt4 remote pair returns the row window without parsing the whole source on the renderer', async () => {
  dom.render(
    createElement(PairDiffTable, {
      before: 'old\n'.repeat(50000),
      after: 'new\n'.repeat(50000),
      fallback: null
    })
  )
  expect(fake.requests[0]).toMatchObject({
    kind: 'diffView',
    source: { kind: 'pair' },
    start: 0,
    end: 1
  })
  fake.resolveNext({
    summary: {
      rowCount: 100000,
      lineCount: 100000,
      added: 50000,
      removed: 50000,
      widthColumns: 3,
      textChars: 300000
    },
    rows: [],
    charsBefore: 0
  })
  await settle()
  expect(fake.requests.at(-1)).toMatchObject({ kind: 'diffView', start: 0, end: 4 })
})
it('dt5 transcript diff owns a bounded inner scroller', () => {
  dom.render(createElement(DiffTable, { lines: lines(401) }))
  const body = dom.query('[data-virtual-diff]')!
  expect(state.owner?.current).toBe(body.parentElement)
  expect(body.parentElement!.props.className).toContain('max-h-[384px]')
})

it('dt3 OpenCode 50000-row patch uses one vertically bounded scroll owner', async () => {
  const view = {
    name: 'fixture',
    kind: 'edit' as const,
    subtitle: '',
    arguments: '',
    outcome: 'completed' as const,
    output: '',
    inputText: '',
    todos: [],
    files: [{ path: 'a.ts', patch: '@@ -0,0 +1,50000 @@\n' + '+added\n'.repeat(50000) }]
  }
  const register = vi.spyOn(fake.client, 'openDocument')
  dom.render(createElement(ToolBody, { view }))
  expect(register.mock.calls[0][1].text === view.files[0].patch, 'registered initial patch').toBe(
    true
  )
  fake.resolveNext({
    summary: {
      rowCount: 50000,
      lineCount: 50000,
      added: 50000,
      removed: 0,
      widthColumns: 5,
      textChars: 250000
    },
    rows: [],
    charsBefore: 0
  })
  await settle()
  const body = dom.query('[data-virtual-diff]')!
  expect(state.owner?.current).toBe(body.parentElement)
  let count = 0
  for (let parent = body.parentElement; parent; parent = parent.parentElement)
    if (String(parent.props.className).includes('overflow-auto')) count++
  expect(count).toBe(1)
  expect(dom.body.textContent).toContain('+50000')
  const updated = {
    ...view,
    files: [{ ...view.files[0], patch: view.files[0].patch.replaceAll('+added', '+changed') }]
  }
  dom.render(createElement(ToolBody, { view: updated }))
  expect(
    register.mock.calls.at(-1)?.[1].text === updated.files[0].patch,
    'registered updated patch'
  ).toBe(true)
  const summary = dom.query('[data-component="opencode-file-diff"]')!.children[0]
  vi.useFakeTimers()
  try {
    dom.click(summary)
  } finally {
    vi.useRealTimers()
  }
  expect(dom.query('[data-virtual-diff]')).toBeNull()
  expect(dom.body.textContent).not.toContain('+changed')
})

it('rt6 pair rows tokenize against their original old and new documents', async () => {
  const open = vi.spyOn(fake.client, 'openDocument')
  dom.render(
    createElement(PairDiffTable, {
      before: 'before',
      after: 'after',
      filePath: 'code.ts',
      fallback: null
    })
  )
  const req = fake.requests[0]
  if (req.kind !== 'diffView' || req.source.kind !== 'pair') throw Error('expected pair diff')
  const model = buildDiffView(
    hunksToDiffLines([
      { value: 'before', removed: true },
      { value: 'after', added: true }
    ]),
    false
  )
  fake.resolveNext(diffViewRows(model, req.options, 0, 1))
  await settle()
  fake.resolveNext(diffViewRows(model, req.options, 0, 2))
  await settle()
  const docs = fake.requests
    .filter((r) => r.kind === 'tokens')
    .map((r) => ('doc' in r ? r.doc : null))
  expect(docs).toEqual([req.source.old, req.source.new])
  expect(open.mock.calls.map(([ref, payload]) => [ref, payload.text])).toEqual([
    [req.source.old, 'before'],
    [req.source.new, 'after']
  ])
})

it('opens the complete numbered document for a large structured Edit result', () => {
  const lines = Array.from({ length: 5_001 }, (_, i) => '+change ' + i)
  const open = vi.spyOn(fake.client, 'openDocument')
  dom.render(
    createElement(DiffBody, {
      call: {
        toolUseId: 'edit',
        name: 'Edit',
        input: { file_path: 'change.ts' },
        result: {
          isError: false,
          output: 'ok',
          structuredOutput: {
            structuredPatch: [
              { oldStart: 0, oldLines: 0, newStart: 1, newLines: lines.length, lines }
            ]
          }
        }
      }
    })
  )
  const req = fake.requests[0]
  if (req?.kind !== 'diffView' || req.source.kind !== 'lines')
    throw Error('expected structured diff')
  const [ref, payload, lane] = open.mock.calls[0]
  expect(ref).toEqual(req.source.doc)
  expect(lane).toBe('compute')
  expect(payload.text).toBe(lines.join('\n'))
  expect(payload.lines?.newLine.at(-1)).toBe(5_001)
})
