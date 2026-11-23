import { createElement } from 'react'
import { it, expect, vi } from 'vitest'
import {
  dom,
  fake,
  useTestVirtualRows
} from '../../../../../shared/ui/virtual/virtualView.testfixture'
import * as gutter from '../../../../../shared/compute/gutter'
import * as index from '../../../../../shared/compute/codeView'
import * as work from '../../../lib/workToolPresentation'
import * as fileSources from '../../opencode/transcript/filePresentation'
import { TimelineDisclosureContext, TimelineViewState } from '../../opencode/transcript/viewState'
import { ToolBody } from '../../opencode/transcript/ToolBody'
import { ToolCard } from './ToolCard'
import { agentUiPolicy } from '../../../lib/agentPresentation'
import { FileBody } from './tool-bodies/FileBody'
import { WorkToolBody } from './WorkToolBody'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => ':fixture:'
}))
vi.mock('../../../../../shared/ui/virtual/useVirtualRows', () => ({
  useVirtualRows: (count: number) => useTestVirtualRows(count)
}))
vi.mock('../../../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key }),
  i18n: { t: (key: string) => key }
}))
vi.mock('../../../../../shared/ui/markdown/CodeBlock', () => ({
  CodeBlock: ({ code }: { code: string }) => createElement('pre', null, code)
}))
it('cs1 read gutter is derived once per source', () => {
  const strip = vi.spyOn(gutter, 'stripLineNumberGutter')
  try {
    const call = {
      name: 'Read',
      toolUseId: 'r',
      input: { file_path: 'a.ts' },
      result: { output: '1\ta\n2\tb', isError: false }
    }
    for (let i = 0; i < 11; i++) dom.render(createElement(FileBody, { call }))
    expect(strip).toHaveBeenCalledOnce()
    expect(dom.body.textContent).toBe('a\nb')
  } finally {
    strip.mockRestore()
  }
})
it.each(['cs2a object', 'cs2b text', 'cs2c task', 'cs2d text array'])(
  '%s memoizes payload and avoids a synchronous large index',
  (kind) => {
    const text = ('x'.repeat(999) + '\n').repeat(5000)
    const output = kind.includes('array')
      ? [{ type: 'text', text }]
      : kind.includes('object')
        ? Array.from({ length: 5000 }, () => text.slice(0, 999))
        : text
    const result = { isError: false, output },
      call = {
        name: kind.includes('task') ? 'TaskUpdate' : 'Fixture',
        toolUseId: 'job',
        input: {},
        result
      }
    const derive = vi.spyOn(work, 'workToolPayload'),
      build = vi.spyOn(index, 'buildCodeIndex')
    try {
      dom.render(createElement(WorkToolBody, { call }))
      const before = derive.mock.calls.length,
        requests = fake.requests.length
      for (let i = 0; i < 10; i++) dom.render(createElement(WorkToolBody, { call: { ...call } }))
      expect(derive.mock.calls.length).toBe(before)
      expect(fake.requests.length).toBe(requests)
      expect(build).not.toHaveBeenCalled()
      expect(fake.requests.some((req) => req.kind === 'codeView')).toBe(true)
    } finally {
      derive.mockRestore()
      build.mockRestore()
    }
  }
)
it('cs6 initially closed OpenCode file skips parsing and worker requests', () => {
  const source = vi.spyOn(fileSources, 'fileDiffSource'),
    state = new TimelineViewState()
  state.disclosures.set('file:fixture:a.ts:0', false)
  const view = {
    name: 'fixture',
    kind: 'edit' as const,
    subtitle: '',
    arguments: '',
    outcome: 'completed' as const,
    output: '',
    inputText: '',
    todos: [],
    files: [{ path: 'a.ts', patch: '@@ -0,0 +1 @@\n+added' }]
  }
  try {
    dom.render(
      createElement(
        TimelineDisclosureContext.Provider,
        { value: state },
        createElement(ToolBody, { view })
      )
    )
    expect(dom.query('[data-component="opencode-file-diff"]')).not.toBeNull()
    expect(source).not.toHaveBeenCalled()
    expect(fake.requests).toHaveLength(0)
  } finally {
    source.mockRestore()
  }
})

it.each([
  ['cs3', 401],
  ['cs3b', 300]
] as const)('%s large numbered Read performs only its chosen transform', (_, count) => {
  const tail = 'a'.repeat(1000001 - count * 3)
  const output = '1\ta\n'.repeat(count - 1) + tail
  const call = {
    name: 'Read',
    toolUseId: 'read',
    input: { file_path: 'a.ts' },
    result: { isError: false, output }
  }
  const strip = vi.spyOn(gutter, 'stripLineNumberGutter')
  try {
    for (let i = 0; i < 11; i++) dom.render(createElement(FileBody, { call }))
    expect(strip).toHaveBeenCalledTimes(count === 300 ? 1 : 0)
    expect(fake.requests.filter((r) => r.kind === 'codeView')).toHaveLength(count === 300 ? 0 : 1)
  } finally {
    strip.mockRestore()
  }
})
it('cs4 OpenCode routes a 200001-character patch to the worker', () => {
  const view = {
    name: 'fixture',
    kind: 'edit' as const,
    subtitle: '',
    arguments: '',
    outcome: 'completed' as const,
    output: '',
    inputText: '',
    todos: [],
    files: [{ path: 'a.ts', patch: '+'.padEnd(200001, 'a') }]
  }
  dom.render(createElement(ToolBody, { view }))
  expect(fake.requests[0]).toMatchObject({ kind: 'diffView', source: { kind: 'patch' } })
})
it('cs5 collapsed Read acquires no lease and performs no gutter work', () => {
  const open = vi.spyOn(fake.client, 'openDocument'),
    strip = vi.spyOn(gutter, 'stripLineNumberGutter')
  try {
    const call = {
      name: 'Read',
      toolUseId: 'closed',
      input: { file_path: 'a.ts' },
      result: { isError: false, output: 'line\n'.repeat(50000) }
    }
    dom.render(
      createElement(ToolCard, { call, transcriptPolicy: agentUiPolicy('code').transcript })
    )
    expect(strip).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
    expect(fake.requests).toHaveLength(0)
  } finally {
    strip.mockRestore()
  }
})
