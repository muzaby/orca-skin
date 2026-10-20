import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import type { ArtifactRef } from '../../../../../../../shared/artifacts'

const h = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  cleanups: [] as (() => void)[],
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
  useEffect: (run: () => (() => void) | void) => {
    const cleanup = run()
    if (cleanup) h.cleanups.push(cleanup)
  }
}))
vi.mock('../../../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key }),
  i18n: { t: (key: string) => key }
}))
vi.mock('../../../../../shared/api/ipc', () => ({ artifactApi: { save: h.save } }))
import { ArtifactViewer } from './ArtifactViewer'
import {
  openArtifactViewer,
  closeArtifactViewer,
  useArtifactViewerStore
} from '../../../store/artifactViewerStore'
import { ArtifactPreviewContent } from './ArtifactPreviewContent'
import { errorToastStore } from '../../../../../shared/errors/errorToastStore'

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
const reveal = vi.fn()
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
function toasts(): unknown[] {
  return errorToastStore.getState().toasts.map(({ title, detail }) => ({ title, detail }))
}
// 0257 D-001 — 뷰어는 복사·다운로드 문구를 어디에도 쓰지 않는다. 본문 상태 안내(불러오는 중·형식
// 미지원, D-003)만 role=status 로 남는다.
const ACTION_MESSAGE_KEYS = [
  'chat.artifactViewer.copyBusy',
  'chat.artifactViewer.downloadBusy',
  'chat.artifactViewer.copied',
  'chat.artifacts.saved',
  'chat.artifacts.cancelled'
]
function strings(node: ReactNode): string[] {
  return Children.toArray(node).flatMap((child) =>
    typeof child === 'string'
      ? [child]
      : isValidElement<Record<string, unknown>>(child)
        ? strings(child.props.children as ReactNode)
        : []
  )
}
function expectQuiet(): void {
  const tree = render()
  expect(strings(tree).filter((text) => ACTION_MESSAGE_KEYS.includes(text))).toEqual([])
  // 본문(data-artifact-viewer-body) 밖의 status 줄 — 본문 안은 내려가지 않는다.
  const outside = (node: ReactNode): ReactElement<Record<string, unknown>>[] =>
    Children.toArray(node).flatMap((child) =>
      isValidElement<Record<string, unknown>>(child) &&
      !('data-artifact-viewer-body' in child.props)
        ? [child, ...outside(child.props.children as ReactNode)]
        : []
    )
  expect(outside(tree).filter((element) => element.props.role === 'status')).toEqual([])
}
function copyIcon(): unknown {
  return all(render()).find((element) => element.props['data-behavior'] === 'viewer:copy')?.props
    .leadingIcon
}
beforeEach(async () => {
  h.states = []
  h.refs = []
  h.cleanups = []
  closeArtifactViewer()
  for (const toast of errorToastStore.getState().toasts)
    errorToastStore.getState().dismiss(toast.id)
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
  reveal.mockReset().mockResolvedValue({ ok: true })
  vi.stubGlobal('window', { orca: { artifacts: { preview, reveal } } })
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  await openArtifactViewer('key', 'session', ref)
})
afterEach(() => vi.unstubAllGlobals())

describe('viewer toolbar production callbacks', () => {
  it.each(['copy', 'download'] as const)(
    'locks both toolbar actions until the pending %s completes',
    async (operation) => {
      let finish!: () => void
      const pending = new Promise<void>((resolve) => {
        finish = resolve
      })
      if (operation === 'copy') writeText.mockReturnValueOnce(pending)
      else h.save.mockReturnValueOnce(pending.then(() => ({ outcome: 'cancelled', items: [] })))
      click(operation)
      click('copy')
      click('download')
      expect(writeText).toHaveBeenCalledTimes(operation === 'copy' ? 1 : 0)
      expect(h.save).toHaveBeenCalledTimes(operation === 'download' ? 1 : 0)
      expectQuiet()
      finish()
      await pending
      await Promise.resolve()
      await Promise.resolve()
      expectQuiet()
      expect(copyIcon()).toBe(operation === 'copy' ? 'check' : 'copy')
    }
  )
  it.each([
    ['copy', 'switch'],
    ['download', 'switch'],
    ['copy', 'close'],
    ['download', 'close'],
    ['copy', 'unmount'],
    ['download', 'unmount']
  ] as const)('drops a late %s result after %s', async (operation, transition) => {
    let finish!: () => void
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    if (operation === 'copy') writeText.mockReturnValueOnce(pending)
    else h.save.mockReturnValueOnce(pending.then(() => ({ outcome: 'cancelled', items: [] })))
    click(operation)
    if (transition === 'switch') {
      await openArtifactViewer('key', 'session', { ...ref, publicationId: 'next' })
      h.states = []
      h.refs = []
      render()
    } else if (transition === 'close') closeArtifactViewer()
    else for (const cleanup of h.cleanups) cleanup()
    const stateBeforeCompletion = [...h.states]
    finish()
    await pending
    await Promise.resolve()
    await Promise.resolve()
    expect(h.states).toEqual(stateBeforeCompletion)
    if (transition === 'switch') expectQuiet()
  })
  it('reveals an unsupported binary file instead of opening a preview', async () => {
    closeArtifactViewer()
    preview.mockResolvedValueOnce({ state: 'unavailable', reason: 'unsupported-format' })
    await openArtifactViewer('key', 'session', {
      ...ref,
      filename: 'report.pdf',
      category: 'file',
      kind: 'file'
    })
    expect(reveal).toHaveBeenCalledExactlyOnceWith({ sessionId: 'session', publicationId: 'p' })
    expect(useArtifactViewerStore.getState().selection).toBeNull()
    expect(h.save).not.toHaveBeenCalled()
  })
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
    expectQuiet()
    expect(copyIcon()).toBe('check')
    writeText.mockRejectedValueOnce(new Error('clipboard denied'))
    click('copy')
    await Promise.resolve()
    // 0242 ΔV2 AC21 — 실패는 toast 로 간다. 0257 — 뷰어 문구는 없다.
    expectQuiet()
    expect(copyIcon()).toBe('copy')
    expect(toasts()).toEqual([
      { title: 'actionFailed', detail: 'report.md: chat.artifactViewer.copyFailed' }
    ])
  })
  it('downloads only the selected publication and distinguishes cancellation and failure', async () => {
    click('download')
    await Promise.resolve()
    expect(h.save).toHaveBeenCalledWith({ sessionId: 'session', publicationIds: ['p'] })
    expectQuiet()
    h.save.mockResolvedValueOnce({ outcome: 'cancelled', items: [] })
    click('download')
    await Promise.resolve()
    expectQuiet()
    h.save.mockRejectedValueOnce(new Error('private path'))
    click('download')
    await Promise.resolve()
    expectQuiet()
    h.save.mockResolvedValueOnce({
      outcome: 'completed',
      items: [{ publicationId: 'p', outcome: 'failed', reason: 'missing' }]
    })
    click('download')
    await Promise.resolve()
    expectQuiet()
    expect(toasts()).toEqual([
      { title: 'fileUnavailable', detail: 'report.md: chat.artifacts.missing' },
      { title: 'actionFailed', detail: 'report.md: chat.artifacts.failed' }
    ])
  })
  it('keeps the open viewer and toasts when another file is inaccessible (0242 ΔV2 AC20 · ΔV4 AC26)', async () => {
    const open = useArtifactViewerStore.getState().selection
    preview.mockResolvedValueOnce({ state: 'unavailable', reason: 'missing' })
    await openArtifactViewer('key', 'session', { ...ref, publicationId: 'gone', title: 'Missing' })
    expect(useArtifactViewerStore.getState().selection).toBe(open)
    expect(all(render()).some((element) => element.props.role === 'alert')).toBe(false)
    expect(toasts()).toEqual([
      { title: 'fileUnavailable', detail: 'report.md: chat.artifacts.missing' }
    ])
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
