import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import type { ArtifactRef } from '../../../../../../shared/artifacts'

const h = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  si: 0,
  ri: 0,
  save: vi.fn()
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: (value: unknown) => {
    const index = h.si++
    if (!(index in h.states)) h.states[index] = value
    return [
      h.states[index],
      (next: unknown) => {
        h.states[index] = next
      }
    ]
  },
  useRef: (value: unknown) => h.refs[h.ri++] ?? (h.refs[h.ri - 1] = { current: value }),
  useEffect: () => undefined
}))
vi.mock('../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('../../../../shared/api/ipc', () => ({ artifactApi: { save: h.save } }))
import { ArtifactViewer } from './ArtifactViewer'
import {
  openArtifactViewer,
  closeArtifactViewer,
  useArtifactViewerStore
} from '../../store/artifactViewerStore'
import { ArtifactPreviewContent } from './ArtifactPreviewContent'

const ref: ArtifactRef = {
  publicationId: 'p',
  artifactFileId: 'f',
  filename: 'report.md',
  title: 'Report',
  kind: 'markdown',
  sizeBytes: 9,
  publishedAt: 1
}
const preview = vi.fn()
const writeText = vi.fn()
function all(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(tree).flatMap((node) =>
    isValidElement<Record<string, unknown>>(node)
      ? [node, ...all(node.props.children as ReactNode)]
      : []
  )
}
function render(): ReactElement {
  h.si = h.ri = 0
  return ArtifactViewer({ selection: useArtifactViewerStore.getState().selection! })
}
function click(behavior: string): void {
  const node = all(render()).find(
    (element) => element.props['data-behavior'] === `viewer:${behavior}`
  )
  expect(node).toBeDefined()
  ;(node!.props.onClick as () => void)()
}
function status(): unknown {
  return all(render()).find((element) => element.props.role === 'status')?.props.children
}
beforeEach(async () => {
  h.states = []
  h.refs = []
  closeArtifactViewer()
  h.save
    .mockReset()
    .mockResolvedValue({ outcome: 'completed', items: [{ publicationId: 'p', outcome: 'saved' }] })
  preview.mockReset().mockResolvedValue({
    state: 'ready',
    format: 'markdown',
    content: '# Selected file',
    mimeType: 'text/markdown'
  })
  writeText.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal('window', { orca: { artifacts: { preview } } })
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  await openArtifactViewer('key', 'session', ref)
})
afterEach(() => vi.unstubAllGlobals())

describe('viewer toolbar production callbacks', () => {
  it('changes the selected file mode, expands, and closes without changing its identity', () => {
    const code = all(render()).find(
      (element) => element.props['aria-label'] === 'chat.artifactViewer.code'
    )!
    ;(code.props.onClick as () => void)()
    const body = all(render()).find((element) => element.type === ArtifactPreviewContent)!
    expect(body.props.mode).toBe('code')
    expect(body.props.title).toBe('Report')
    click('expand')
    expect(useArtifactViewerStore.getState().selection).toMatchObject({
      expanded: true,
      artifact: ref
    })
    click('expand')
    expect(useArtifactViewerStore.getState().selection?.expanded).toBe(false)
    click('close')
    expect(useArtifactViewerStore.getState().selection).toBeNull()
  })
  it('copies the selected content and reports success or clipboard failure', async () => {
    click('copy')
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledWith('# Selected file')
    expect(status()).toBe('chat.artifactViewer.copied')
    writeText.mockRejectedValueOnce(new Error('clipboard denied'))
    click('copy')
    await Promise.resolve()
    expect(status()).toBe('chat.artifactViewer.copyFailed')
  })
  it('downloads only the selected publication and distinguishes cancellation and failure', async () => {
    click('download')
    await Promise.resolve()
    expect(h.save).toHaveBeenCalledWith({ sessionId: 'session', publicationIds: ['p'] })
    expect(status()).toBe('chat.artifacts.saved')
    h.save.mockResolvedValueOnce({ outcome: 'cancelled', items: [] })
    click('download')
    await Promise.resolve()
    expect(status()).toBe('chat.artifacts.cancelled')
    h.save.mockRejectedValueOnce(new Error('private path'))
    click('download')
    await Promise.resolve()
    expect(status()).toBe('chat.artifacts.failed')
  })
  it('shows the selected error and executes retry instead of retaining an old body', async () => {
    preview.mockResolvedValueOnce({ state: 'unavailable', reason: 'missing' })
    await openArtifactViewer('key', 'session', { ...ref, title: 'Missing' })
    expect(all(render()).find((element) => element.props.role === 'alert')?.props.children).toBe(
      'chat.artifacts.missing'
    )
    expect(all(render()).some((element) => element.type === ArtifactPreviewContent)).toBe(false)
    click('retry')
    expect(useArtifactViewerStore.getState().selection?.loading).toBe(true)
    await Promise.resolve()
    expect(useArtifactViewerStore.getState().selection?.result).toMatchObject({
      state: 'ready',
      content: '# Selected file'
    })
  })
  it('does not offer copying or code mode for a selected image', async () => {
    preview.mockResolvedValueOnce({
      state: 'ready',
      format: 'image',
      content: 'data:image/png;base64,aA==',
      mimeType: 'image/png'
    })
    await openArtifactViewer('key', 'session', { ...ref, kind: 'image' })
    const nodes = all(render())
    expect(nodes.some((element) => element.props['data-behavior'] === 'viewer:copy')).toBe(false)
    expect(
      nodes.find((element) => element.props['aria-label'] === 'chat.artifactViewer.code')?.props
        .disabled
    ).toBe(true)
  })
})
