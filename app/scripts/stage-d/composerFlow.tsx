import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { ComposerInputController } from '@renderer/features/chat/harnesses/common/composer/ComposerInputController'
import { composerModule } from '@renderer/features/chat/harnesses/claude/composer/Module'
import { fakeComputeClient } from '@renderer/shared/compute/fakeClient.testfixture'
import { setComputeClient } from '@renderer/shared/compute/client'
import type { AttachmentView, ComposerAttachment } from '../../src/shared/ipc'

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))
const noop = (): void => {}
const data =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR2sAAAAASUVORK5CYII='
const marker = 'data:image/jpeg;base64,'

export async function measureComposerFlow(
  source: 'dialog' | 'drag_drop' | 'clipboard',
  onReopen?: (views: AttachmentView[]) => Promise<unknown>
): Promise<unknown> {
  const host = document.createElement('div')
  document.body.append(host)
  let failure = ''
  const root = createRoot(host, {
    onUncaughtError: (error) => {
      failure = error instanceof Error ? (error.stack ?? error.message) : String(error)
    }
  })
  const previous = window.oo
  const compute = fakeComputeClient()
  setComputeClient(compute.client)
  const names = Array.from({ length: 5 }, (_, index) => 'source-' + index + '.png')
  const picked = names.map((name) => ({
    name,
    path: '/' + name,
    mimeType: 'image/png',
    sizeBytes: 68
  }))
  const reads: string[] = []
  const late: Array<() => void> = []
  let picks = 0
  let accepted = false
  let sends = 0
  let saved: AttachmentView[] = []
  let original: ComposerAttachment[] = []
  const transfer = (files: string[]): DataTransfer => {
    const transfer = new DataTransfer()
    for (const name of files)
      transfer.items.add(
        new File([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], name, { type: 'image/png' })
      )
    return transfer
  }
  Object.assign(window, {
    oo: {
      provider: { state: async () => ({ providers: [] }), onState: () => noop },
      skills: { list: async () => [] },
      session: {
        onManagedMcpChanged: () => noop,
        nativeResources: async () => ({ items: [], revision: 1 })
      },
      files: {
        pathForFile: (file: File) => '/' + file.name,
        pickAttachments: async () =>
          ++picks === 1 && source === 'dialog'
            ? picked
            : new Promise((resolve) => late.push(() => resolve(picked))),
        readAttachment: async (path: string) => {
          reads.push(path)
          return { data, mimeType: 'image/png' }
        }
      }
    }
  })
  const text = '첨부 보내기'
  const render = (draft: string): void =>
    flushSync(() =>
      root.render(
        <ComposerInputController
          presentation={composerModule}
          active
          backendLabel="Claude"
          canAbort={false}
          inflight={false}
          steerBlocked={false}
          toolApprovalPending={false}
          cwd={null}
          initialDraft={draft}
          onSend={(value, items, views) => {
            if (value !== text) throw Error('draft mismatch')
            sends++
            original = items
            saved = views
            return accepted
          }}
          diffRequirementSnapshot={{
            sessionKey: 'stage-d',
            sessionId: 'stage-d',
            ids: [],
            revision: 0,
            anchors: []
          }}
          onClearDiffRequirementsIfUnchanged={noop}
          onCancel={noop}
          controlsStart={null}
          controlsEnd={null}
        />
      )
    )
  const openDialog = async (): Promise<void> => {
    const trigger = host.querySelector<HTMLButtonElement>('button[aria-haspopup]')
    if (!trigger) throw Error('attachment trigger missing ' + failure + ' ' + host.textContent)
    flushSync(() => trigger.click())
    await frame()
    const add = document.querySelector<HTMLElement>(
      '[data-cascade-level="0"][data-cascade-index="0"]'
    )
    if (!add) throw Error('missing attachment menu')
    flushSync(() => add.click())
  }
  try {
    render(text)
    await frame()
    const surface = host.querySelector<HTMLElement>('[data-harness]')!
    const drop = (files: string[]): void => {
      surface.dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer(files) })
      )
    }
    if (source === 'dialog') await openDialog()
    if (source === 'drag_drop') drop(names)
    if (source === 'clipboard')
      surface.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: transfer(names)
        })
      )
    for (let i = 0; i < 100 && compute.requests.length !== 5; i++) await frame()
    if (compute.requests.length !== 5)
      throw Error('attachment intake ' + source + ' ' + compute.requests.length)
    compute.resolveNext({ thumbnail: marker + 'YQ==' })
    compute.resolveNext({ thumbnail: marker + 'Yg==' })
    compute.rejectNext()
    await frame()
    const area = host.querySelector('textarea')!
    const send = host.querySelector<HTMLButtonElement>('[data-behavior="action:send"]')!
    area.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'ㅎ' }))
    flushSync(() => send.click())
    if (sends !== 0) throw Error('sent during composition')
    area.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한' }))
    flushSync(() => send.click())
    const preserved =
      area.value === text &&
      saved.length === 5 &&
      Number(sends) === 1 &&
      compute.cancelled.length === 0
    await openDialog()
    // The callback recorded here belongs to the old draft.
    if (late.length !== 1) throw Error('delayed dialog did not open')
    accepted = true
    flushSync(() => send.click())
    await Promise.resolve()
    const sameTask = area.value === '' && document.activeElement === area && Number(sends) === 2
    const previews = saved.map((view) => view.previewDataUrl ?? null)
    if (
      !preserved ||
      !sameTask ||
      compute.cancelled.length !== 2 ||
      new Set(saved.map((x) => x.id)).size !== 5 ||
      JSON.stringify(previews) !==
        JSON.stringify([marker + 'YQ==', marker + 'Yg==', null, null, null]) ||
      original.some(
        (item, i) =>
          item.name !== names[i] ||
          item.sourceKind !== source ||
          (source === 'clipboard'
            ? item.kind !== 'inline' || item.data !== data
            : item.kind !== 'path' || item.path !== picked[i].path)
      ) ||
      reads.length !== (source === 'clipboard' ? 0 : 5)
    )
      throw Error(
        'submission mismatch ' +
          JSON.stringify({
            source,
            preserved,
            sameTask,
            previews,
            reads,
            cancelled: compute.cancelled.length
          })
      )
    render('후속 초안')
    drop(['later.png'])
    late[0]()
    await frame()
    const survived =
      area.value === '후속 초안' &&
      Number(compute.requests.length) === 6 &&
      host.querySelectorAll('button[aria-label*="later.png"]').length === 1
    if (!survived) throw Error('late input replaced the new draft')
    return {
      ...(onReopen && { reopened: await onReopen(saved) }),
      source,
      accepted: 5,
      previews: 2,
      sameTask,
      reads: reads.length - 1,
      cancelled: 2,
      followup: survived
    }
  } finally {
    root.unmount()
    host.remove()
    Object.assign(window, { oo: previous })
    setComputeClient(null)
  }
}
