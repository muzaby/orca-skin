import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { MemoryRouter } from 'react-router-dom'
import { ChatTile } from '@renderer/features/chat/components/ChatTile'
import { useChatStore, chatActions } from '@renderer/features/chat/store/chatStore'
import { layerKey } from '@renderer/features/chat/lib/rightPanelStack'
import { panelActions, useRightPanelStore } from '@renderer/features/chat/store/rightPanelStore'
import { TweakProvider } from '@renderer/shared/theme/TweakProvider'
import { installNativeFixture, nativeCalls } from '../fixtures/opencode-ui/native'
import { resetScenario, swapSession } from '../fixtures/opencode-ui/scenarios'
import { measureArtifacts } from './artifact'
import {
  pairedBounds,
  layerOffset,
  firstVisibleParagraph,
  readingDelta,
  type PairedBounds
} from './observations.mjs'
import { measureSurfaces } from './surfaces'
import css from '@renderer/styles/app.css?inline'

installNativeFixture()
resetScenario('long-history-selection', 'claude')
const style = document.createElement('style')
style.textContent = css + '\nbody{margin:0}#root{height:100vh;display:flex;flex-direction:column}'
document.head.append(style)
const root = createRoot(document.querySelector('#root')!)
function renderApp(): void {
  flushSync(() =>
    root.render(
      <MemoryRouter>
        <TweakProvider>
          <ChatTile backendLabel="Claude" canAbort />
        </TweakProvider>
      </MemoryRouter>
    )
  )
}
renderApp()
type Measurement = { name: string; ok: boolean; [field: string]: unknown }
type Reversal<T> = { when: (sample: T) => boolean; action: () => void }
type Step = (name: string) => void

const frame = (): Promise<number> =>
  new Promise<number>((resolve) => requestAnimationFrame(resolve))
const find = (selector: string): HTMLElement => document.querySelector<HTMLElement>(selector)!
const frameNode = (): HTMLElement => find('[data-right-panel-frame]')
const active = (): HTMLElement | null => find('[data-right-panel-layer]:not([inert])')
const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1
const waitFrames = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await frame()
}
function setKind(agentKind: 'code' | 'work'): void {
  useChatStore.setState((state) => {
    const key = state.activeKey,
      entry = state.sessions[key]
    return {
      sessions: { ...state.sessions, [key]: { ...entry, session: { ...entry.session, agentKind } } }
    }
  })
}
async function observeFrames<T = never>(
  action: () => void,
  read?: () => T,
  reverse?: Reversal<T>
): Promise<{ samples: T[]; reversedAt?: T; count: number }> {
  const samples: T[] = []
  let count = 0
  const sample = (): void => {
    count++
    if (read) samples.push(read())
  }
  sample()
  flushSync(action)
  let start = performance.now()
  let reversedAt: T | undefined
  do {
    sample()
    const current = samples.at(-1)
    if (reverse && reversedAt === undefined && current !== undefined && reverse.when(current)) {
      reversedAt = current
      flushSync(reverse.action)
      start = performance.now()
    }
    await frame()
  } while (count < 20 || performance.now() - start < 380)
  sample()
  return { samples, reversedAt, count }
}
function scroller(): HTMLElement {
  let node = find('[data-transcript-viewport]').parentElement
  while (node && !['auto', 'scroll'].includes(getComputedStyle(node).overflowY))
    node = node.parentElement
  if (!node) throw Error('No transcript scroll owner')
  return node
}

async function measureReading(step: Step): Promise<Measurement> {
  step('reading-position')
  const element = scroller()
  element.dispatchEvent(new WheelEvent('wheel', { deltaY: -500, bubbles: true }))
  element.scrollTop = Math.round((element.scrollHeight - element.clientHeight) * 0.6)
  await waitFrames(5)
  step('reading-select')
  const anchor = firstVisibleParagraph(element)
  if (!anchor) return { name: 'pairedWidth-reading', ok: false, error: 'No visible paragraph' }
  step('reading-panel-close')
  const motion = await observeFrames(() => panelActions.close())
  step('reading-verify')
  const delta = readingDelta(element, anchor)
  return {
    name: 'pairedWidth-reading',
    ok: delta !== null && Math.abs(delta) <= 2,
    delta,
    key: anchor.key,
    frames: motion.count
  }
}

async function measureSessionSwitches(step: Step): Promise<Measurement[]> {
  const root = frameNode()
  const records: Measurement[] = []
  const targets = [
    ['claude-code-to-claude-code', 'claude', 'code'],
    ['claude-code-to-claude-work', 'claude', 'work'],
    ['claude-to-opencode', 'opencode', 'code'],
    ['opencode-to-opencode', 'opencode', 'code'],
    ['opencode-to-claude', 'claude', 'code']
  ] as const
  for (const [name, backend, agentKind] of targets) {
    step('switch-' + name + '-setup')
    const oldLayer = active()
    const measurement = await observeFrames(
      () => {
        useChatStore.setState((state) => {
          const key = Object.keys(state.sessions).find((k) => k !== state.activeKey)!
          const entry = state.sessions[key]
          return {
            sessions: {
              ...state.sessions,
              [key]: {
                ...entry,
                session: { ...entry.session, backend, agentKind, providerKey: backend + ':fixture' }
              }
            }
          }
        })
        step('switch-' + name)
        swapSession()
      },
      () => root.getBoundingClientRect().width
    )
    const minWidth = Math.min(...measurement.samples)
    records.push({
      name: 'switch-' + name,
      ok:
        root === frameNode() &&
        minWidth > 0 &&
        !!active() &&
        oldLayer !== active() &&
        useRightPanelStore.getState().stack.length === 1,
      minWidth
    })
  }
  return records
}

async function measureLifecycle(): Promise<Measurement> {
  const stack = (): string[] => useRightPanelStore.getState().stack.map(layerKey)
  async function restartRenderer(): Promise<void> {
    // The settings host survives the window. Recreate both the renderer's settings
    // provider and its in-memory panel store, as on a new renderer boot.
    flushSync(() => root.render(null))
    useRightPanelStore.setState(useRightPanelStore.getInitialState(), true)
    renderApp()
    await observeFrames(() => {})
  }

  await observeFrames(() => resetScenario('session-switch-anchor', 'claude'))
  await observeFrames(() => panelActions.close())
  const originalFrame = frameNode()
  await observeFrames(() => chatActions.toggleRightPanelTile('plan'))
  await observeFrames(() => chatActions.toggleRightPanelTile('diff'))
  await observeFrames(() => chatActions.toggleRightPanelTile('subagent'))
  const pushed = stack()
  await observeFrames(() => find('[data-panel-back]').click())
  const popped = stack()
  const originalWidth = frameNode().getBoundingClientRect().width
  await observeFrames(() =>
    find('[role=separator]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
    )
  )
  const savedWidth = frameNode().getBoundingClientRect().width
  await observeFrames(() => {
    swapSession()
    setKind('work')
  })
  const switched = stack()
  const retainedFrame = frameNode() === originalFrame
  await observeFrames(() => panelActions.close())
  await restartRenderer()
  const restoredClosed = stack().length === 0 && frameNode().getBoundingClientRect().width === 0
  await observeFrames(swapSession)
  await observeFrames(() => chatActions.toggleRightPanelTile('diff'))
  const beforeOpenRestart = stack()
  const oldFrame = frameNode()
  await restartRenderer()
  const restoredOpen = stack()
  const restoredWidth = frameNode().getBoundingClientRect().width
  return {
    name: 'lifecycle-restart',
    ok:
      pushed.join() === 'plan,diff,subagent' &&
      popped.join() === 'plan,diff' &&
      switched.join() === 'task' &&
      retainedFrame &&
      restoredClosed &&
      beforeOpenRestart.join() === 'diff' &&
      frameNode() !== oldFrame &&
      restoredOpen.join() === 'plan' &&
      savedWidth > originalWidth &&
      restoredWidth === savedWidth,
    pushed,
    popped,
    switched,
    retainedFrame,
    restoredClosed,
    beforeOpenRestart,
    restoredOpen,
    originalWidth,
    savedWidth,
    restoredWidth
  }
}

let dragStart = 0
let dragTrust = false
Object.assign(window, {
  measureArtifacts,
  measureSurfaces,
  measureLifecycle,
  async checkClampedWidth() {
    await observeFrames(() => {})
    const width = frameNode().getBoundingClientRect().width
    const available = find('[data-side-pane-host]').clientWidth
    const target = Math.min(available - 240, 960)
    return { name: 'kindWidth-host-clamp', width, available, target, ok: width === target }
  },
  async checkEqualWidths() {
    for (const kind of ['work', 'code'] as const) {
      flushSync(() => setKind(kind))
      await observeFrames(() => {})
      flushSync(() =>
        find('[role=separator]').dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Home', bubbles: true })
        )
      )
      await observeFrames(() => {})
    }
    const panel = frameNode()
    const { samples: widths } = await observeFrames(
      () => setKind('work'),
      () => panel.getBoundingClientRect().width
    )
    return { name: 'kindWidth-equal', ok: widths.every((width) => width === 320), widths }
  },
  async preparePanelDrag() {
    flushSync(() => {
      setKind('code')
      panelActions.tile('plan')
    })
    await observeFrames(() => {})
    const separator = find('[role=separator]')
    const rect = separator.getBoundingClientRect()
    dragStart = nativeCalls.length
    dragTrust = false
    separator.addEventListener(
      'pointerdown',
      (e) => {
        dragTrust = e.isTrusted
      },
      { once: true }
    )
    return {
      x: Math.round(rect.x + rect.width / 2),
      y: Math.round(rect.y + rect.height / 2),
      before: frameNode().getBoundingClientRect().width
    }
  },
  async checkPanelDrag(before: number, delta: number) {
    await waitFrames(4)
    const measured = frameNode().getBoundingClientRect().width
    const writes = nativeCalls.slice(dragStart).filter((c) => c.operation === 'settings.set')
    const stored = writes
      .map(
        (call) =>
          (call.args[0] as { rightPanelWidths?: { code: number; work: number } })?.rightPanelWidths
      )
      .filter(Boolean)
      .at(-1)
    flushSync(() => setKind('work'))
    await observeFrames(() => {})
    const work = frameNode().getBoundingClientRect().width
    flushSync(() => setKind('code'))
    await observeFrames(() => {})
    const restored = frameNode().getBoundingClientRect().width
    return {
      name: 'native-drag-mode-persistence',
      ok:
        dragTrust &&
        Math.abs(measured - before - delta) <= 2 &&
        stored?.code === measured &&
        stored.work === work &&
        restored === measured,
      before,
      delta,
      measured,
      restored,
      work,
      stored,
      trusted: dragTrust
    }
  }
})
Object.assign(window, {
  async measureRightPanel() {
    await document.fonts.ready
    await waitFrames(12)
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const frameElement = frameNode()
    const records: Measurement[] = []
    const steps = [{ name: 'position-bottom', start: performance.now() }]
    const step = (name: string): number => steps.push({ name, start: performance.now() })
    const longTasks: PerformanceEntry[] = []
    const observer = new PerformanceObserver((list) => {
      longTasks.push(...list.getEntries())
    })
    observer.observe({ type: 'longtask', buffered: false })
    const widthCheck = async (
      name: string,
      action: () => void,
      target: number,
      reverse?: Reversal<PairedBounds>
    ): Promise<void> => {
      step(name)
      const panel = frameNode()
      const pane = find('[data-chat-pane-content]')
      const host = find('[data-side-pane-host]')
      const m = await observeFrames(action, () => pairedBounds(pane, panel, host), reverse)
      const first = m.samples[0].width
      const last = m.samples.at(-1)!.width
      const seam = Math.max(...m.samples.map((row) => Math.abs(row.seam)))
      const hostError = Math.max(...m.samples.map((row) => row.hostError))
      const intermediates = m.samples.filter(
        ({ width }) => Math.min(first, target) + 1 < width && width < Math.max(first, target) - 1
      ).length
      const motion = reverse ? !!m.reversedAt : reduced ? intermediates === 0 : intermediates > 0
      records.push({
        name,
        ok:
          frameElement === frameNode() &&
          near(last, target) &&
          seam <= 1 &&
          hostError <= 1 &&
          motion,
        frames: m.samples.length,
        first,
        last,
        intermediates,
        reversedWidth: m.reversedAt?.width,
        hostError,
        seam
      })
    }
    const bottom = scroller()
    bottom.scrollTop = bottom.scrollHeight
    await waitFrames(3)
    const distanceToEnd = (): number => bottom.scrollHeight - bottom.clientHeight - bottom.scrollTop
    const bottomBefore = distanceToEnd()
    await widthCheck('pairedWidth-open', () => chatActions.toggleRightPanelTile('plan'), 520)
    const bottomAfter = distanceToEnd()
    records.push({
      name: 'pairedWidth-bottom',
      ok: bottomBefore <= 2 && bottomAfter <= 2,
      bottomBefore,
      bottomAfter
    })
    step('depth-forward')
    const depth = (): number => layerOffset(active())
    const forward = await observeFrames(() => panelActions.tile('diff'), depth)
    const goBack = find('[data-panel-back]')
    records.push({
      name: 'depth-forward',
      ok:
        active()?.dataset.rightPanelLayer === 'diff' &&
        !!goBack &&
        (reduced ? forward.samples.every((x) => near(x, 0)) : forward.samples.some((x) => x > 1)),
      forward: forward.samples
    })
    step('depth-back')
    const back = await observeFrames(() => goBack?.click(), depth)
    records.push({
      name: 'depth-back',
      ok:
        active()?.dataset.rightPanelLayer === 'plan' &&
        (reduced ? back.samples.every((x) => near(x, 0)) : back.samples.some((x) => x < -1)),
      back: back.samples
    })
    step('depth-interrupt')
    const interrupted = await observeFrames(() => panelActions.tile('diff'), depth, {
      when: (x) => reduced || (x > 1 && x < (active()?.clientWidth ?? 0) - 1),
      action: () => panelActions.back()
    })
    const activeLayers = document.querySelectorAll('[data-right-panel-layer]:not([inert])')
    records.push({
      name: 'depth-interrupt',
      ok:
        interrupted.reversedAt !== undefined &&
        activeLayers.length === 1 &&
        active()?.dataset.rightPanelLayer === 'plan' &&
        useRightPanelStore.getState().stack.at(-1)?.kind === 'tile',
      reversedX: interrupted.reversedAt,
      frames: interrupted.samples.length
    })
    await widthCheck('pairedWidth-close', () => panelActions.close(), 0)
    await widthCheck('pairedWidth-reverse', () => panelActions.tile('plan'), 0, {
      // Start the return on an observed outward frame. Under load the first
      // rendered frame can come after a fixed 65ms timer would have fired.
      when: ({ width }) => (reduced ? near(width, 520) : width > 1 && width < 519),
      action: () => panelActions.close()
    })
    await widthCheck('pairedWidth-reopen', () => panelActions.tile('plan'), 520)
    step('resize-persistence')
    const separator = find('[role=separator]')
    const writesBefore = nativeCalls.length
    separator?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    await observeFrames(() => {})
    const codeWidth = frameNode().getBoundingClientRect().width
    records.push({
      name: 'resize-persistence',
      ok:
        codeWidth > 520 &&
        nativeCalls.slice(writesBefore).some((c) => c.operation === 'settings.set'),
      codeWidth
    })
    await widthCheck('mode-width-work', () => setKind('work'), 360)
    await widthCheck('mode-width-code', () => setKind('code'), codeWidth)
    records.push(await measureReading(step))
    step('reading-reopen-diff')
    await observeFrames(() => panelActions.tile('diff'))
    records.push(...(await measureSessionSwitches(step)))
    longTasks.push(...observer.takeRecords())
    records.push({
      name: 'long-task-observation',
      ok: longTasks.length === 0,
      durations: longTasks.map((e) => e.duration),
      operations: longTasks.map(
        (e) => steps.findLast((s) => s.start <= e.startTime)?.name ?? 'initial'
      ),
      // One task can straddle fixture setup, a user action and the next observation.
      phases: longTasks.map((e) =>
        steps
          .filter(
            (s, i) =>
              s.start < e.startTime + e.duration && (steps[i + 1]?.start ?? Infinity) > e.startTime
          )
          .map((s) => s.name)
      )
    })
    observer.disconnect()
    for (const [group, measure] of [
      ['artifacts', measureArtifacts],
      ['surfaces', measureSurfaces]
    ] as const) {
      try {
        records.push(...(await measure()))
      } catch (error) {
        records.push({ name: group, ok: false, error: String(error) })
      }
    }
    return records
  }
})
