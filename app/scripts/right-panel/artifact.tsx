import { flushSync } from 'react-dom'
import type {
  ArtifactPreviewResult,
  ArtifactRef,
  ArtifactTargetRequest
} from '../../src/shared/artifacts'
import { useArtifactViewerStore } from '@renderer/features/chat/store/artifactViewerStore'
import { newTranscriptChanges } from '@renderer/features/chat/lib/transcript/changeLog'
import { layerKey } from '@renderer/features/chat/lib/rightPanelStack'
import { useChatStore } from '@renderer/features/chat/store/chatStore'
import { panelActions, useRightPanelStore } from '@renderer/features/chat/store/rightPanelStore'
import { errorToastStore } from '@renderer/shared/errors/errorToastStore'
import { swapSession } from '../fixtures/opencode-ui/scenarios'

const publications: ArtifactRef[] = ['first', 'second', 'third'].map((id) => ({
  publicationId: id,
  artifactFileId: 'file-' + id,
  title: id,
  filename: id + '.txt',
  kind: 'text',
  sizeBytes: 8,
  publishedAt: 1
}))
const ready: ArtifactPreviewResult = {
  state: 'ready',
  format: 'text',
  content: 'probe text',
  mimeType: 'text/plain'
}
const frame = (): Promise<number> => new Promise((resolve) => requestAnimationFrame(resolve))
async function until(check: () => boolean): Promise<boolean> {
  const deadline = performance.now() + 1200
  do {
    await frame()
    if (check()) return true
  } while (performance.now() < deadline)
  return false
}

export async function measureArtifacts(): Promise<
  { name: string; ok: boolean; [key: string]: unknown }[]
> {
  const results: { name: string; ok: boolean; [key: string]: unknown }[] = []
  const pending: {
    target: ArtifactTargetRequest
    resolve: (result: ArtifactPreviewResult) => void
  }[] = []
  const reveals: ArtifactTargetRequest[] = []
  const previous = window.oo
  const artifacts = new Proxy(previous.artifacts, {
    get(target, method) {
      if (method === 'preview')
        return (target: ArtifactTargetRequest) =>
          new Promise<ArtifactPreviewResult>((resolve) => pending.push({ target, resolve }))
      if (method === 'reveal')
        return async (target: ArtifactTargetRequest) => {
          reveals.push(target)
          return { ok: true }
        }
      return Reflect.get(target, method)
    }
  })
  window.oo = new Proxy(previous, {
    get(target, name) {
      return name === 'artifacts' ? artifacts : Reflect.get(target, name)
    }
  })
  const sessionKey = useChatStore.getState().activeKey
  const sessionId = useChatStore.getState().sessions[sessionKey].session.sessionId
  const frameNode = (): HTMLElement =>
    document.querySelector<HTMLElement>('[data-right-panel-frame]')!
  const active = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('[data-right-panel-layer]:not([inert])')
  const width = (): number => frameNode().getBoundingClientRect().width
  const stack = (): string[] => useRightPanelStore.getState().stack.map(layerKey)
  const card = (id: string): HTMLButtonElement | null =>
    document.querySelector<HTMLButtonElement>('[data-artifact-preview="' + id + '"]')
  const record = (name: string, ok: boolean, details: Record<string, unknown> = {}): number =>
    results.push({ name: 'artifact-' + name, ok, stack: stack(), ...details })
  const request = (id: string) => {
    const count = pending.length
    flushSync(() => card(id)?.click())
    const call = pending[count]
    if (!call || call.target.sessionId !== sessionId || call.target.publicationId !== id)
      throw Error(
        'Missing artifact preview IPC for ' +
          JSON.stringify({
            id,
            expectedSession: sessionId,
            activeSession: useChatStore.getState().activeKey,
            previous: results.at(-1)?.name,
            requests: pending.map((p) => p.target),
            hasCard: !!card(id),
            disabled: card(id)?.disabled
          })
      )
    return async (response: ArtifactPreviewResult = ready) => {
      call.resolve(response)
      await frame()
      await frame()
    }
  }
  const isViewer = (id: string): boolean =>
    !!active()?.querySelector('[data-artifact-viewer="' + id + '"]')
  try {
    // Seed one published turn in the active transcript. Its real card callbacks carry the
    // clicked button and captured session identity through the production preview bridge.
    flushSync(() => {
      useChatStore.setState((state) => {
        const entry = state.sessions[sessionKey]
        return {
          sessions: {
            ...state.sessions,
            [sessionKey]: {
              ...entry,
              session: {
                ...entry.session,
                transcriptChanges: newTranscriptChanges(),
                messages: [
                  {
                    id: 'probe-user',
                    role: 'user',
                    createdAt: 1,
                    parts: [{ type: 'text', text: 'show files' }]
                  },
                  {
                    id: 'probe-reply',
                    role: 'assistant',
                    createdAt: 2,
                    parts: publications.map((artifact) => ({ type: 'artifact', artifact }))
                  }
                ]
              }
            }
          }
        }
      })
      panelActions.tile('plan')
      panelActions.close()
    })
    if (!(await until(() => !!card('first') && !!card('second') && width() < 1)))
      throw Error(
        'Artifact probe start ' +
          JSON.stringify({
            cards: [...document.querySelectorAll('[data-artifact-preview]')].map((e) =>
              e.getAttribute('data-artifact-preview')
            ),
            width: width(),
            stack: stack(),
            messages: useChatStore
              .getState()
              .sessions[sessionKey].session.messages.map((m) => m.id),
            visible: document.querySelector('[data-transcript-viewport]')?.textContent?.slice(-300)
          })
      )

    const first = request('first')
    record(
      'A1-pending',
      card('first')?.getAttribute('aria-busy') === 'true' &&
        useArtifactViewerStore.getState().opening?.sessionKey === sessionKey &&
        !stack().length &&
        width() < 1
    )
    await first()
    const opened = await until(
      () =>
        width() > 0 &&
        Math.abs(width() - parseFloat(frameNode().style.width)) <= 1 &&
        isViewer('first')
    )
    record('A2-open', opened && stack().join() === 'plan,artifact:first', { width: width() })

    const originalLayer = active()
    const countBeforeSame = pending.length
    flushSync(() => card('first')?.click())
    const same =
      countBeforeSame === pending.length &&
      originalLayer === active() &&
      stack().join() === 'plan,artifact:first'
    await request('second')()
    const pushed = stack().join() === 'plan,artifact:first,artifact:second' && isViewer('second')
    await request('first')()
    record(
      'A3-push-pop-to-same',
      same && pushed && stack().join() === 'plan,artifact:first' && isViewer('first'),
      { same, pushed }
    )

    await request('second')({ state: 'unavailable', reason: 'unsupported-format' })
    record(
      'A4-reveal',
      reveals.length === 1 &&
        reveals[0].publicationId === 'second' &&
        reveals[0].sessionId === sessionId &&
        isViewer('first') &&
        stack().join() === 'plan,artifact:first'
    )
    await request('second')({ state: 'unavailable', reason: 'missing' })
    const failure = errorToastStore
      .getState()
      .toasts.find(
        (toast) =>
          toast.title === 'fileUnavailable' && toast.detail?.includes(publications[1].filename)
      )
    record(
      'A5-missing',
      !!failure &&
        reveals.length === 1 &&
        isViewer('first') &&
        stack().join() === 'plan,artifact:first'
    )

    const earlier = request('third')
    const latest = request('second')
    await latest()
    await earlier()
    record(
      'A7-latest',
      stack().join() === 'plan,artifact:first,artifact:second' && isViewer('second')
    )
    flushSync(() => active()?.querySelector<HTMLElement>('[data-panel-back]')?.click())
    const back = isViewer('first') && card('second') === document.activeElement
    const backButton = active()?.querySelector<HTMLElement>('[data-panel-back]')
    backButton?.focus()
    flushSync(() =>
      backButton?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      )
    )
    record(
      'A8-back-escape-focus',
      back &&
        stack().join() === 'plan' &&
        active()?.dataset.rightPanelLayer === 'plan' &&
        card('first') === document.activeElement,
      { back }
    )

    await request('second')()
    flushSync(() => active()?.querySelector<HTMLElement>('[data-behavior="viewer:close"]')?.click())
    const closed = await until(() => width() < 1)
    record('A9-close', closed && !stack().length && !active())

    const stale = request('first')
    flushSync(swapSession)
    await frame()
    const cancelled = !useArtifactViewerStore.getState().opening
    await stale()
    record(
      'A6-session-change',
      cancelled &&
        useChatStore.getState().activeKey !== sessionKey &&
        !stack().length &&
        width() < 1 &&
        !useArtifactViewerStore.getState().selection,
      { cancelled }
    )
  } finally {
    window.oo = previous
  }
  return results
}
