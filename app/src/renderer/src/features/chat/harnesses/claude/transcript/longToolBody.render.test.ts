import { createElement } from 'react'
import { it, expect, vi } from 'vitest'
import { WorkToolBody } from './WorkToolBody'
import {
  dom,
  fake,
  settle,
  useTestVirtualRows
} from '../../../../../shared/ui/virtual/virtualView.testfixture'
import { ToolCard } from './ToolCard'
import { agentUiPolicy } from '../../../lib/agentPresentation'
import { DiffBody } from './tool-bodies/DiffBody'
import { FileBody } from './tool-bodies/FileBody'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => ':fixture:'
}))
vi.mock('../../../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key }),
  i18n: { t: (key: string) => key }
}))

vi.mock('../../../../../shared/ui/virtual/useVirtualRows', () => ({
  useVirtualRows: (count: number) => useTestVirtualRows(count)
}))
vi.mock('../../common/transcript/ForegroundShellActions', () => ({
  ForegroundShellActions: () => null
}))
vi.mock('../../../hooks/useSmallDiffSyntax', () => ({ useSmallDiffSyntax: () => new Map() }))
const source = Array.from({ length: 401 }, (_, i) => 'row ' + i).join('\n')
it('lb1 Claude pair edit mounts a window of a 401-line diff', async () => {
  dom.render(
    createElement(DiffBody, {
      call: { name: 'Edit', toolUseId: 'edit', input: { old_string: '', new_string: source } }
    })
  )
  expect(fake.requests[0]).toMatchObject({ kind: 'diffView', source: { kind: 'pair' } })
  fake.resolveNext({
    summary: {
      rowCount: 401,
      lineCount: 401,
      added: 401,
      removed: 0,
      widthColumns: 10,
      textChars: source.length
    },
    rows: [],
    charsBefore: 0
  })
  await settle()
  expect(dom.query('[data-virtual-diff]')).not.toBeNull()
  expect(fake.requests.at(-1)).toMatchObject({ kind: 'diffView', start: 0, end: 4 })
})
it.each([400, 401])('lb2/lb3 Read uses the line boundary at %i rows', (count) => {
  const text = source.split('\n').slice(0, count).join('\n')
  dom.render(
    createElement(FileBody, {
      call: {
        name: 'Read',
        toolUseId: 'read',
        input: { file_path: 'a.txt' },
        result: { isError: false, output: text }
      }
    })
  )
  expect(!!dom.query('[data-virtual-code]')).toBe(count > 400)
  expect(dom.body.textContent).toContain('row 0')
})
it('lb4 long Work error retains its style and the response window', () => {
  dom.render(
    createElement(WorkToolBody, {
      call: {
        name: 'tool',
        toolUseId: 'work',
        input: {},
        result: { isError: true, output: source }
      }
    })
  )
  expect(dom.query('[data-virtual-code]')).not.toBeNull()
  expect(dom.query('[aria-label="chat.workTool.error"]')!.props.className).toContain('bg-bad')
  expect(dom.body.textContent).toContain('row 0')
})

it('lb5 card header copies the full source including rows outside the mounted read window', async () => {
  const call = {
    name: 'Read',
    toolUseId: 'r',
    input: { file_path: 'a.txt' },
    result: { isError: false, output: source }
  }
  const writeText = vi.fn(async () => {})
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  dom.render(createElement(ToolCard, { call, transcriptPolicy: agentUiPolicy('code').transcript }))
  dom.act(() => (dom.query('[data-focus-id="toggle"]')!.props.onClick as () => void)())
  expect(dom.body.textContent).toContain('row 0')
  expect(dom.body.textContent).not.toContain('row 400')
  dom.act(() => (dom.query('[aria-label="common.copy"]')!.props.onClick as () => void)())
  await settle()
  expect(writeText).toHaveBeenCalledExactlyOnceWith(source)
})
