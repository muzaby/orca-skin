import { createElement } from 'react'
import { it, expect, vi } from 'vitest'
import { dom, fake, visible, settle } from '../../../../shared/ui/virtual/virtualView.testfixture'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => ':fixture:'
}))
vi.mock('../../../../shared/ui/virtual/useVirtualRows', async () => ({
  useVirtualRows: (await import('../../../../shared/ui/virtual/virtualView.testfixture'))
    .useTestVirtualRows
}))
import { ArtifactPreviewContent } from '../../harnesses/common/rightpanel/ArtifactPreviewContent'
import { revisionOf } from '../../../../shared/compute/documents'
vi.mock('../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
import { VirtualMarkdownView } from './VirtualMarkdownView'
import { setComputeClient } from '../../../../shared/compute/client'
const source = Array.from({ length: 1500 }, (_, i) => '# Heading ' + i).join('\n\n')
const render = (text = source): void =>
  dom.render(createElement(VirtualMarkdownView, { source: text }))
it('m1 requests mounted blocks only', () => {
  render()
  expect(fake.requests).toHaveLength(4)
  expect(dom.queryAll('[data-index]')).toHaveLength(4)
})
it('m2 pending blocks display exact raw source', () => {
  render()
  expect(dom.query('[data-md-block-pending]')!.textContent).toBe('# Heading 0\n\n')
})
it('m3 worker HAST replaces the pending source', async () => {
  render()
  fake.resolveNext({
    hast: {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'h1',
          properties: {},
          children: [{ type: 'text', value: 'Heading 0' }]
        }
      ]
    }
  })
  await settle()
  expect(dom.body.textContent).toContain('Heading 0')
  expect(dom.queryAll('[data-md-block-pending]')).toHaveLength(3)
})
it('m4 scroll releases old block jobs and reaches the final source', () => {
  render()
  visible.first = 1496
  render()
  expect(fake.cancelled).toHaveLength(4)
  expect(dom.body.textContent).toContain('Heading 1499')
})
it('m5 stale in-flight parse cannot replace the new document', async () => {
  const replies: ((r: unknown) => void)[] = []
  setComputeClient({
    ...fake.client,
    request: () => ({
      promise: new Promise<never>((resolve) => replies.push(resolve as (r: unknown) => void)),
      cancel: vi.fn(),
      setPriority: vi.fn()
    })
  })
  render('old')
  render('new')
  replies[0]({ hast: { type: 'root', children: [{ type: 'text', value: 'stale' }] } })
  await settle()
  expect(dom.body.textContent).toBe('new')
})
it('m6 oversized block stays raw without a request', () => {
  render('x'.repeat(50001))
  expect(fake.requests).toHaveLength(0)
  expect(dom.query('[data-md-block-raw]')).not.toBeNull()
})
it('m7 node budget fallback shows raw text', async () => {
  render('**bold**')
  fake.resolveNext({ tooLarge: true })
  await settle()
  expect(dom.query('[data-md-block-raw]')!.textContent).toBe('**bold**')
})
it('m7 later oversized chunk removes previously rendered table rows and stops further requests', async () => {
  const source = '| title |\n| --- |\n' + '| value |\n'.repeat(401)
  render(source)
  expect(fake.requests).toHaveLength(1)
  fake.resolveNext({
    hast: {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'table',
          properties: {},
          children: [{ type: 'element', tagName: 'tbody', properties: {}, children: [] }]
        }
      ]
    }
  })
  await settle()
  expect(fake.requests).toHaveLength(2)
  expect(dom.query('[data-md-block-pending]')).toBeNull()
  fake.resolveNext({ tooLarge: true })
  await settle()
  expect(dom.query('[data-md-block-raw]')!.textContent).toBe(source)
  expect(fake.requests).toHaveLength(2)
})

it('opens an artifact Markdown document under the publication and result revision', () => {
  const result = {
    state: 'ready' as const,
    format: 'markdown' as const,
    content: source,
    mimeType: 'text/markdown'
  }
  const open = vi.spyOn(fake.client, 'openDocument')
  dom.render(
    createElement(ArtifactPreviewContent, {
      result,
      mode: 'preview',
      title: 'Report',
      publicationId: 'report'
    })
  )
  expect(open).toHaveBeenCalledWith(
    { id: 'md:report', revision: revisionOf(result) },
    { text: source, lines: undefined },
    'markdown'
  )
})
