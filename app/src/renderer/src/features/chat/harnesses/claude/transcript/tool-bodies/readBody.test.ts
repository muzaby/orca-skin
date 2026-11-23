import { createElement } from 'react'
import { it, expect, vi } from 'vitest'
import { FileBody } from './FileBody'
import { copyText } from '../toolCopyText'
import { requestKey } from '../../../../../../shared/compute/protocol'
import { dom, fake, settle } from '../../../../../../shared/ui/virtual/virtualView.testfixture'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => ':read:'
}))
vi.mock('../../../../../../shared/ui/virtual/useVirtualRows', async () => ({
  useVirtualRows: (await import('../../../../../../shared/ui/virtual/virtualView.testfixture'))
    .useTestVirtualRows
}))
vi.mock('../../../../../../shared/ui/markdown/CodeBlock', () => ({
  CodeBlock: ({ code }: { code: string }) => createElement('pre', { 'data-small': '' }, code)
}))
function input(rows: number, size: number): string {
  const lines = Array.from({ length: rows }, (_, i) => i + 1 + '\tline' + i)
  const body = lines.join('\n')
  return body + 'x'.repeat(size - body.length)
}
function read(output: string): {
  name: string
  input: { file_path: string }
  toolUseId: string
  result: { isError: boolean; output: string }
} {
  return {
    name: 'Read',
    input: { file_path: 'sample.ts' },
    toolUseId: 'read',
    result: { isError: false, output }
  }
}
it.each([
  [400, 1000000],
  [400, 1000001],
  [401, 1000000],
  [401, 1000001]
])(
  'rd1/rd2 choose local or worker gutter transform for %i rows and %i characters',
  async (rows, size) => {
    const call = read(input(rows, size))
    dom.render(createElement(FileBody, { call }))
    if (rows === 400) {
      expect(dom.query('[data-small]')!.textContent.startsWith('line0\nline1')).toBe(true)
      expect(fake.requests).toHaveLength(0)
      return
    }
    if (size > 1000000) {
      expect(fake.requests[0]).toMatchObject({
        kind: 'codeView',
        source: { view: { transform: 'stripGutter' } }
      })
      fake.resolveNext({
        lines: ['line0', 'line1', 'line2', 'line3'],
        lineCount: rows,
        widthColumns: 100,
        textChars: size,
        charsBefore: 0
      })
      await settle()
    }
    expect(dom.query('[data-virtual-text]')!.textContent).toBe('line0')
    const token = fake.requests.find((req) => req.kind === 'tokens')!
    expect(token).toMatchObject({ view: { transform: 'stripGutter' } })
    expect(requestKey(token)).toContain('|stripGutter')
  }
)
it('rd3 read display excludes gutter and header copy preserves full numbered source', () => {
  const call = read(input(401, 5000))
  dom.render(createElement(FileBody, { call }))
  expect(dom.query('[data-transcript-chrome]')!.textContent).toBe('1')
  expect(dom.query('[data-virtual-text]')!.textContent).toBe('line0')
  expect(copyText(call)).toBe(call.result.output)
})
