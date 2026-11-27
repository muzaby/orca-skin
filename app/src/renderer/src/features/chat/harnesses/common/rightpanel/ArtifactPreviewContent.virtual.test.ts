import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { markdownBlock } from '../../../../../shared/compute/worker/markdown'
import { ArtifactPreviewContent } from './ArtifactPreviewContent'
import type { FakeNode } from '../../../../../shared/ui/renderHarness.testfixture'
import type { ArtifactPreviewResult } from '../../../../../../../shared/artifacts'
import { revisionOf } from '../../../../../shared/compute/documents'
import { dom, fake, settle } from '../../../../../shared/ui/virtual/virtualView.testfixture'
import { ArtifactViewer } from './ArtifactViewer'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => ':fixture:'
}))
const { virtualRows } = vi.hoisted(() => ({ virtualRows: vi.fn() }))
vi.mock('../../../../../shared/ui/virtual/useVirtualRows', async () => ({
  useVirtualRows: virtualRows.mockImplementation(
    (await import('../../../../../shared/ui/virtual/virtualView.testfixture')).useTestVirtualRows
  )
}))
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))

afterEach(() => vi.useRealTimers())

type Ready = Extract<ArtifactPreviewResult, { state: 'ready' }>
const content = Array.from({ length: 401 }, (_, i) => '# Heading ' + i).join('\n')

it.each([
  { format: 'markdown', mode: 'code' },
  { format: 'text', mode: 'preview' },
  { format: 'markdown', mode: 'preview' }
] as const)('retains the $format $mode document until the result changes', ({ format, mode }) => {
  const result: Ready = { state: 'ready', format, content, mimeType: 'text/' + format }
  virtualRows.mockClear()
  const render = (value: Ready, title: string): void =>
    dom.render(
      createElement(ArtifactViewer, {
        selection: {
          sessionKey: 's',
          sessionId: 's',
          request: 1,
          expanded: true,
          loading: false,
          mode,
          artifact: {
            publicationId: 'report',
            artifactFileId: 'f',
            filename: 'report',
            title,
            kind: format,
            sizeBytes: content.length,
            publishedAt: 1
          },
          result: value
        }
      })
    )
  const markdown = mode === 'preview' && format === 'markdown'
  const id = markdown ? 'md:report' : 'code:artifact:report'
  const lane = markdown ? 'markdown' : 'compute'

  const register = fake.client.openDocument
  const open = vi.spyOn(fake.client, 'openDocument').mockImplementationOnce((ref, ...args) => {
    expect(ref).toEqual({ id, revision: revisionOf(result) })
    return register(ref, ...args)
  })

  if (!markdown) {
    render({ ...result, content: content.slice(0, content.lastIndexOf('\n')) }, 'Report')
    expect(dom.query('[data-virtual-code]')).toBeNull()
    expect(open).not.toHaveBeenCalled()
  }
  render(result, 'Report')
  render(result, 'Renamed')
  expect(virtualRows).toHaveBeenCalled()
  const panel = dom.query('[data-artifact-viewer-body]')
  expect(panel).not.toBeNull()
  for (const [, , owner] of virtualRows.mock.calls) expect(owner.current).toBe(panel)
  expect(open.mock.calls).toEqual([
    [{ id, revision: revisionOf(result) }, { text: content, lines: undefined }, lane]
  ])

  const replacement = { ...result }
  render(replacement, 'Renamed')
  expect(open).toHaveBeenCalledTimes(2)
  expect(open).toHaveBeenLastCalledWith(
    { id, revision: revisionOf(replacement) },
    { text: content, lines: undefined },
    lane
  )
})

it('AC8 renders a 2,001-row table as one table and retains earlier rows when appending', async () => {
  vi.useFakeTimers()
  const content =
    '| header |\n| --- |\n' + Array.from({ length: 2001 }, (_, i) => '| row-' + i + ' |\n').join('')
  dom.render(
    createElement(ArtifactPreviewContent, {
      mode: 'preview',
      title: 'report',
      publicationId: 'table',
      result: { state: 'ready', format: 'markdown', mimeType: 'text/markdown', content }
    })
  )
  function nodes(tag: string, root: FakeNode = dom.body): FakeNode[] {
    return [
      ...(root.tag === tag ? [root] : []),
      ...root.children.flatMap((child) => nodes(tag, child))
    ]
  }
  let first: FakeNode | undefined
  for (let i = 0; i < 11; i++) {
    const request = fake.requests[i]
    if (request?.kind !== 'markdown') throw Error('Expected a table chunk')
    fake.resolveNext(markdownBlock({ text: content }, request))
    await settle()
    // Drain the real component's scheduled HAST frames in the fake DOM.
    for (let frame = 0; frame < 100 && nodes('td').length < Math.min(2001, 200 * (i + 1)); frame++)
      dom.frame()
    expect(nodes('table')).toHaveLength(1)
    expect(nodes('th')).toHaveLength(1)
    const cells = nodes('td')
    expect(cells.length).toBe(Math.min(2001, 200 * (i + 1)))
    expect(cells[0].textContent).toBe('row-0')
    if (first) expect(cells[0]).toBe(first)
    first = cells[0]
    expect(cells.at(-1)?.textContent).toBe('row-' + (cells.length - 1))
  }
  expect(dom.query('[data-md-block-pending]')).toBeNull()
})
