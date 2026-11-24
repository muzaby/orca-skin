import { createElement } from 'react'
import { expect, it, vi } from 'vitest'
import type { ArtifactPreviewResult } from '../../../../../../../shared/artifacts'
import { revisionOf } from '../../../../../shared/compute/documents'
import { dom, fake } from '../../../../../shared/ui/virtual/virtualView.testfixture'
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
