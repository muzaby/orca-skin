import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { MemoryRouter } from 'react-router-dom'
import { ChatTile } from '@renderer/features/chat/components/ChatTile'
import { useChatStore, chatActions } from '@renderer/features/chat/store/chatStore'
import { panelActions, useRightPanelStore } from '@renderer/features/chat/store/rightPanelStore'
import { TweakProvider } from '@renderer/shared/theme/TweakProvider'
import { installNativeFixture, nativeCalls } from '../fixtures/opencode-ui/native'
import { resetScenario, swapSession } from '../fixtures/opencode-ui/scenarios'
import { measureArtifacts } from './artifact'
import { measureSurfaces } from './surfaces'
import css from '@renderer/styles/app.css?inline'

installNativeFixture()
resetScenario('long-history-selection', 'claude')
const style = document.createElement('style')
style.textContent = css + '\nbody{margin:0}#root{height:100vh;display:flex;flex-direction:column}'
document.head.append(style)
const root = createRoot(document.querySelector('#root')!)
flushSync(() =>
  root.render(
    <MemoryRouter>
      <TweakProvider>
        <ChatTile backendLabel="Claude" canAbort />
      </TweakProvider>
    </MemoryRouter>
  )
)
type Measurement = { name: string; ok: boolean; [field: string]: unknown }
type FrameSample = { width: number; seam: number; hostError: number; x: number }

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
async function geometry(
  action: () => void,
  reverse?: () => void
): Promise<{
  samples: FrameSample[]
  first: number
  last: number
  seam: number
  hostError: number
}> {
  const f = frameNode(),
    pane = find('[data-chat-pane-content]'),
    host = find('[data-side-pane-host]')
  const samples: FrameSample[] = []
  const read = (): void => {
    const a = pane.getBoundingClientRect(),
      b = f.getBoundingClientRect(),
      outer = host.getBoundingClientRect()
    const target = active()
    samples.push({
      width: b.width,
      seam: b.left - a.right,
      hostError: Math.max(
        Math.abs(outer.left - a.left),
        Math.abs(outer.right - b.right),
        Math.abs(outer.width - a.width - b.width)
      ),
      x: target
        ? target.getBoundingClientRect().x - (target.parentElement?.getBoundingClientRect().x ?? 0)
        : 0
    })
  }
  read()
  flushSync(action)
  let start = performance.now(),
    reversed = false
  do {
    read()
    if (reverse && !reversed && performance.now() - start > 65) {
      flushSync(reverse)
      reversed = true
      start = performance.now()
    }
    await frame()
  } while (samples.length < 20 || performance.now() - start < 380)
  read()
  return {
    samples,
    first: samples[0].width,
    last: samples.at(-1)!.width,
    seam: Math.max(...samples.map((row) => Math.abs(row.seam))),
    hostError: Math.max(...samples.map((row) => row.hostError))
  }
}
function scroller(): HTMLElement {
  let node = find('[data-transcript-viewport]').parentElement
  while (node && !['auto', 'scroll'].includes(getComputedStyle(node).overflowY))
    node = node.parentElement
  if (!node) throw Error('No transcript scroll owner')
  return node
}

async function measureReading(): Promise<Measurement> {
  const element = scroller()
  element.dispatchEvent(new WheelEvent('wheel', { deltaY: -500, bubbles: true }))
  element.scrollTop = Math.round((element.scrollHeight - element.clientHeight) * 0.6)
  await waitFrames(5)
  const rect = element.getBoundingClientRect()
  const visible = Array.from(element.querySelectorAll<HTMLElement>('p')).filter((p) => {
    const y = p.getBoundingClientRect().top - rect.top
    return y >= 0 && y < element.clientHeight - 20 && !!p.textContent?.trim()
  })
  const anchor = visible[0]
  if (!anchor) return { name: 'pairedWidth-reading', ok: false, error: 'No visible paragraph' }
  const key = anchor.closest('[data-block-key]')?.getAttribute('data-block-key')
  const text = anchor.textContent
  const y = anchor.getBoundingClientRect().top
  const motion = await geometry(() => panelActions.close())
  const end = Array.from(element.querySelectorAll<HTMLElement>('p')).find(
    (p) =>
      p.textContent === text &&
      p.closest('[data-block-key]')?.getAttribute('data-block-key') === key
  )
  const delta = end ? end.getBoundingClientRect().top - y : null
  return {
    name: 'pairedWidth-reading',
    ok: delta !== null && Math.abs(delta) <= 2,
    delta,
    key,
    frames: motion.samples.length
  }
}

async function measureSessionSwitches(): Promise<Measurement[]> {
  const root = frameNode()
  const records = []
  const targets = [
    ['claude-code-to-claude-code', 'claude', 'code'],
    ['claude-code-to-claude-work', 'claude', 'work'],
    ['claude-to-opencode', 'opencode', 'code'],
    ['opencode-to-opencode', 'opencode', 'code'],
    ['opencode-to-claude', 'claude', 'code']
  ] as const
  for (const [name, backend, agentKind] of targets) {
    const oldLayer = active()
    const measurement = await geometry(() => {
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
      swapSession()
    })
    const minWidth = Math.min(...measurement.samples.map((s) => s.width))
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

let dragStart = 0
let dragTrust = false
Object.assign(window, {
  measureArtifacts,
  measureSurfaces,
  async checkClampedWidth() {
    await geometry(() => {})
    const width = frameNode().getBoundingClientRect().width
    const available = find('[data-side-pane-host]').clientWidth
    const target = Math.min(available - 240, 960)
    return { name: 'kindWidth-host-clamp', width, available, target, ok: width === target }
  },
  async checkEqualWidths() {
    for (const kind of ['work', 'code'] as const) {
      flushSync(() => setKind(kind))
      await geometry(() => {})
      flushSync(() =>
        find('[role=separator]').dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Home', bubbles: true })
        )
      )
      await geometry(() => {})
    }
    const switched = await geometry(() => setKind('work'))
    const widths = switched.samples.map((s) => s.width)
    return { name: 'kindWidth-equal', ok: widths.every((width) => width === 320), widths }
  },
  async preparePanelDrag() {
    flushSync(() => {
      setKind('code')
      panelActions.tile('plan')
    })
    await geometry(() => {})
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
    await geometry(() => {})
    const work = frameNode().getBoundingClientRect().width
    flushSync(() => setKind('code'))
    await geometry(() => {})
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
      reverse?: () => void
    ): Promise<void> => {
      step(name)
      const m = await geometry(action, reverse)
      const intermediates = m.samples.filter(
        ({ width }) =>
          Math.min(m.first, target) + 1 < width && width < Math.max(m.first, target) - 1
      ).length
      const moved = m.samples.some((row) => Math.abs(row.width - m.first) > 1)
      const motion = reverse ? reduced || moved : reduced ? intermediates === 0 : intermediates > 0
      records.push({
        name,
        ok:
          frameElement === frameNode() &&
          near(m.last, target) &&
          m.seam <= 1 &&
          m.hostError <= 1 &&
          motion,
        frames: m.samples.length,
        first: m.first,
        last: m.last,
        intermediates,
        hostError: m.hostError,
        seam: m.seam
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
    const forward = await geometry(() => panelActions.tile('diff'))
    const goBack = find('[data-panel-back]')
    records.push({
      name: 'depth-forward',
      ok:
        active()?.dataset.rightPanelLayer === 'diff' &&
        !!goBack &&
        (reduced || forward.samples.some((s) => s.x > 1)),
      forward: forward.samples.map((s) => s.x)
    })
    step('depth-back')
    const back = await geometry(() => goBack?.click())
    records.push({
      name: 'depth-back',
      ok:
        active()?.dataset.rightPanelLayer === 'plan' &&
        (reduced || back.samples.some((s) => s.x < -1)),
      back: back.samples.map((s) => s.x)
    })
    step('depth-interrupt')
    const interrupted = await geometry(
      () => panelActions.tile('diff'),
      () => panelActions.back()
    )
    const activeLayers = document.querySelectorAll('[data-right-panel-layer]:not([inert])')
    records.push({
      name: 'depth-interrupt',
      ok:
        activeLayers.length === 1 &&
        active()?.dataset.rightPanelLayer === 'plan' &&
        useRightPanelStore.getState().stack.at(-1)?.kind === 'tile',
      frames: interrupted.samples.length
    })
    await widthCheck('pairedWidth-close', () => panelActions.close(), 0)
    await widthCheck(
      'pairedWidth-reverse',
      () => panelActions.tile('plan'),
      0,
      () => panelActions.close()
    )
    await widthCheck('pairedWidth-reopen', () => panelActions.tile('plan'), 520)
    step('resize-persistence')
    const separator = find('[role=separator]')
    const writesBefore = nativeCalls.length
    separator?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    await geometry(() => {})
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
    step('pairedWidth-reading')
    records.push(await measureReading())
    await geometry(() => panelActions.tile('diff'))
    step('session-switches')
    records.push(...(await measureSessionSwitches()))
    longTasks.push(...observer.takeRecords())
    records.push({
      name: 'long-task-observation',
      ok: longTasks.length === 0,
      durations: longTasks.map((e) => e.duration),
      operations: longTasks.map(
        (e) => steps.findLast((s) => s.start <= e.startTime)?.name ?? 'initial'
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
