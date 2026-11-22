// 0326 ΔV2 AT-07 probe page — production `TranscriptView` for one screen with a fixed input whose
// rendered text is known (D-102 · D-103 · D-105). `electron-main.mjs` drives it with real input events.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { AppMessagePart, LoadedMessage } from '../../src/shared/ipc'
import { TranscriptView } from '@renderer/features/chat/components/transcript/TranscriptView'
import { chatReducer, initialChatState } from '@renderer/features/chat/reducer/chatReducer'
import { ingestChatEvent, useChatStore } from '@renderer/features/chat/store/chatStore'
import appCss from '@renderer/styles/app.css?inline'

const style = document.createElement('style')
style.textContent =
  appCss + '\nhtml, body { margin: 0; } #root { height: 560px; width: 900px; display: flex; }'
document.head.appendChild(style)

const TURNS = 30
// Plain paragraphs: rendered text equals the source except the bold marker (`**`).
const fixtureText = {
  user: (i: number) => `Q${i} question text`,
  first: (i: number) => `M${i}a alpha bravo charlie delta echo`,
  second: (i: number) => `M${i}b foxtrot golf hotel india`,
  secondSource: (i: number) => `M${i}b foxtrot **golf** hotel india`,
  cardBody: (i: number) => `RESULT-${i}-body`
}

function messages(): {
  id: string
  role: 'user' | 'assistant'
  createdAt: number
  parts: AppMessagePart[]
}[] {
  const out: LoadedMessage[] = []
  for (let i = 0; i < TURNS; i++) {
    out.push({
      id: `u:sel-${i}`,
      role: 'user' as const,
      createdAt: i * 2 + 1,
      parts: [{ type: 'text', text: fixtureText.user(i) }] as AppMessagePart[]
    })
    const parts: AppMessagePart[] = [
      { type: 'text', text: fixtureText.first(i) },
      { type: 'tool_call', toolRunId: `t-${i}`, toolName: 'Read', args: { file_path: `f${i}.ts` } },
      { type: 'tool_result', toolRunId: `t-${i}`, result: fixtureText.cardBody(i), isError: false },
      { type: 'text', text: fixtureText.secondSource(i) }
    ]
    if (i === 1)
      parts.push({
        type: 'tool_call',
        toolRunId: 'late',
        toolName: 'Read',
        args: { file_path: 'late.ts' }
      })
    out.push({ id: `a:sel-${i}`, role: 'assistant' as const, createdAt: i * 2 + 2, parts })
  }
  return out
}

/** Markers in document order with their rendered text. */
const markers: { marker: string; text: string }[] = []
for (let i = 0; i < TURNS; i++) {
  markers.push({ marker: `Q${i} `, text: fixtureText.user(i) })
  markers.push({ marker: `M${i}a `, text: fixtureText.first(i) })
  markers.push({ marker: `M${i}b `, text: fixtureText.second(i) })
}

const params = new URLSearchParams(location.search)
const [backend, agentKind] = params.get('screen')!.split('-') as [
  'claude' | 'opencode',
  'code' | 'work'
]
const key = 'selection-' + backend + '-' + agentKind
const loaded = chatReducer({ ...initialChatState, sessionId: key, backend, agentKind }, {
  type: 'LOAD_SESSION',
  session: { id: key, title: 'Selection probe', agentKind, backend, messages: messages() },
  complete: true
} as never)
useChatStore.setState({
  activeKey: key,
  sessions: {
    [key]: {
      session: loaded,
      live: { text: '', reasoning: '', reasoningVisible: false },
      subagentMeta: {}
    }
  }
} as never)

export function Screen(): React.JSX.Element {
  const state = useChatStore((s) => s.sessions[key].session)
  return (
    <TranscriptView
      backend={backend}
      agentKind={agentKind}
      messages={state.messages}
      inflight={false}
      loadingSession={false}
      anchored={false}
      pendingSteer={[]}
      scrollRef={React.useRef(null)}
      contentRef={React.useRef(null)}
      onScroll={() => {}}
    />
  )
}

const composer = document.createElement('p')
composer.id = 'composer'
composer.textContent = 'composer draft text for selection'
composer.style.cssText = 'margin:0;height:24px;font:14px sans-serif;user-select:text'
const outside = document.createElement('div')
outside.id = 'outside'
const paste = document.createElement('textarea')
paste.id = 'paste'
paste.style.cssText = 'position:fixed;left:910px;top:0;width:80px;height:40px'
document.body.prepend(composer)
document.body.append(outside, paste)
const root = createRoot(document.querySelector('#root')!)
flushSync(() => root.render(<Screen />))

const frame = (): Promise<void> =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const scroller = (): HTMLElement =>
  document.querySelector<HTMLElement>('[data-behavior="virtualizable"]')!

// Row mounts — new `data-block-key` rows inside the viewport since `mark()`.
let knownKeys = new Set<string>()
let mountedSinceMark = 0
const rowKeys = (): string[] =>
  Array.from(document.querySelectorAll('[data-transcript-viewport] [data-index]'), (row) =>
    row.getAttribute('data-block-key')!
  )
new MutationObserver(() => {
  for (const k of rowKeys()) {
    if (!knownKeys.has(k)) {
      knownKeys.add(k)
      mountedSinceMark++
    }
  }
}).observe(document.querySelector('#root')!, { childList: true, subtree: true })

const longTasks: PerformanceEntry[] = []
new PerformanceObserver((list) => longTasks.push(...list.getEntries())).observe({
  type: 'longtask',
  buffered: true
})
let perfMark = 0
let copyPrevented: boolean | null = null
window.addEventListener('copy', (event) => {
  copyPrevented = event.defaultPrevented
})

function textPoint(element: Element, offset: number): { node: Text; offset: number } {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let left = offset
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (left <= node.data.length) return { node, offset: left }
    left -= node.data.length
  }
  throw new Error('offset beyond element text')
}

/** The smallest rendered element whose text is exactly the marker's paragraph. */
function markerElement(marker: string): HTMLElement | null {
  const entry = markers.find((m) => m.marker === marker)!
  const view = document.querySelector('[data-transcript-viewport]')!
  const walker = document.createTreeWalker(view, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.startsWith(marker)) continue
    let el = node.parentElement
    while (el && el.textContent?.trim() !== entry.text) el = el.parentElement
    if (el) return el
  }
  return null
}

function visible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  const s = scroller().getBoundingClientRect()
  return r.height > 0 && r.top >= s.top + 8 && r.bottom <= s.bottom - 8
}

Object.assign(globalThis, {
  ooProbe: {
    ready: true,
    async settle() {
      await frame()
      await frame()
      await frame()
    },
    mark() {
      knownKeys = new Set(rowKeys())
      mountedSinceMark = 0
      perfMark = performance.now()
      copyPrevented = null
      performance.clearMeasures('oo-selection-cancel')
    },
    state() {
      return {
        mountedKeys: mountedSinceMark,
        selection: document.getSelection()?.toString() ?? '',
        copyPrevented,
        longTasks: longTasks.filter((t) => t.startTime >= perfMark).map((t) => t.duration),
        cancelMs: performance.getEntriesByName('oo-selection-cancel').map((m) => m.duration)
      }
    },
    scrollTo(where: 'top' | 'bottom') {
      const el = scroller()
      el.scrollTop = where === 'top' ? 0 : el.scrollHeight
    },
    scrollerRect() {
      const r = scroller().getBoundingClientRect()
      return { x: r.left, y: r.top, width: r.width, height: r.height }
    },
    /** A multi-block pair (≥ 3 rendered blocks) or a single paragraph, both on screen. */
    pick(kind: 'single' | 'multi') {
      const shown = markers.filter((m) => {
        const el = markerElement(m.marker)
        return el && visible(el)
      })
      const first = shown.find((m) => m.marker.startsWith('M'))
      if (!first) throw new Error('no visible paragraph')
      if (kind === 'single') return { start: [first.marker, 3], end: [first.marker, 15] }
      const from = shown.indexOf(first)
      const last = shown[Math.min(shown.length - 1, from + 3)]
      if (shown.indexOf(last) - from < 2) throw new Error('fewer than three visible blocks')
      return { start: [first.marker, 3], end: [last.marker, 6] }
    },
    /** Expected paste for a forward pair, computed from the fixture text (not the DOM). */
    expected(start: [string, number], end: [string, number]) {
      const a = markers.findIndex((m) => m.marker === start[0])
      const b = markers.findIndex((m) => m.marker === end[0])
      const sm = markers[a]
      const em = markers[b]
      if (a === b) {
        return {
          start: sm.text.slice(start[1], end[1]),
          end: sm.text.slice(start[1], end[1]),
          markers: [],
          forbid: [],
          multi: false
        }
      }
      const between = markers
        .slice(a + 1, b)
        .filter((m) => markerElement(m.marker))
        .map((m) => m.marker.trim())
      const turns = markers.slice(a, b + 1).map((m) => Number(/\d+/.exec(m.marker)![0]))
      return {
        start: sm.text.slice(start[1]),
        end: em.text.slice(0, end[1]),
        markers: between,
        forbid: [...new Set(turns)].map(fixtureText.cardBody),
        multi: true
      }
    },
    point(marker: string, offset: number) {
      const el = markerElement(marker)
      if (!el) throw new Error('marker not rendered: ' + marker)
      const at = textPoint(el, offset)
      const range = document.createRange()
      range.setStart(at.node, at.offset)
      range.setEnd(at.node, Math.min(at.node.data.length, at.offset + 1))
      const r = range.getBoundingClientRect()
      return { x: Math.round(r.left + 1), y: Math.round(r.top + r.height / 2) }
    },
    composerPoints() {
      const r = composer.getBoundingClientRect()
      return { from: { x: r.left + 3, y: r.top + 12 }, to: { x: r.left + 120, y: r.top + 12 } }
    },
    focusPaste() {
      paste.value = ''
      paste.focus()
    },
    pasted() {
      return paste.value
    },
    appendBlock(n: number) {
      const sessionId = key
      ingestChatEvent({
        type: 'message.committed',
        sessionId,
        ids: [`u:appended-${n}`],
        text: `Appended question ${n}`,
        messageKey: `u:appended-${n}`,
        messageId: 1000 + n,
        createdAt: 10_000 + n
      } as never)
    },
    lateResult() {
      ingestChatEvent({
        type: 'tool.call.completed',
        sessionId: key,
        toolRunId: 'late',
        result: 'late result body',
        isError: false,
        messageKey: 'a:sel-1',
        messageKeySource: 'owner'
      } as never)
    },
    outsideMutate() {
      const node = document.createElement('span')
      node.textContent = 'outside ' + outside.childElementCount
      outside.append(node)
    }
  }
})
