import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { AppMessagePart, LoadedMessage } from '../../src/shared/ipc'
import { emptyBackgroundState } from '../../src/shared/background-task'
import { chatActions, ingestChatEvent, useChatStore } from '@renderer/features/chat/store/chatStore'
import { HarnessScrollController } from '@renderer/features/chat/components/transcript/HarnessScrollController'
import { TranscriptView } from '@renderer/features/chat/components/transcript/TranscriptView'
import { chatReducer } from '@renderer/features/chat/reducer/chatReducer'
import { capture, measureAccepted, scrollToPosition } from './failure-cards'
import appCss from '@renderer/styles/app.css?inline'

const query = new URLSearchParams(location.search)
const [backend, agentKind] = query.get('screen')!.split('-') as [
  'claude' | 'opencode',
  'code' | 'work'
]
const scenario = query.get('scenario')
const accepted = scenario === 'acceptedFailures' || scenario === 'reopenedFailures'
const reopened = scenario === 'reopenedFailures'
const id = accepted ? capture.id : 'transcript-layout'
const error = { category: 'stream_error' as const, message: 'Fixture failure', retryable: false }
const text = (text: string): AppMessagePart => ({ type: 'text', text })
const call = (toolRunId: string, toolName: string, args: unknown): AppMessagePart => ({
  type: 'tool_call',
  toolRunId,
  toolName,
  args
})
const msg = (id: string, role: 'user' | 'assistant', parts: AppMessagePart[]): LoadedMessage => ({
  id,
  role,
  parts,
  createdAt: 1
})
const lines = (n: number, prefix: string): string =>
  Array.from({ length: n }, (_, i) => prefix + i).join('\n')
const activity = (
  body: AppMessagePart[],
  outcome: 'aborted' | 'ended' = 'ended'
): AppMessagePart[] => [
  { type: 'response_boundary', boundary: { phase: 'begin', id: 'response' } },
  ...body,
  { type: 'response_boundary', boundary: { phase: 'end', id: 'response', outcome } }
]
function toolMatrix(name: string): LoadedMessage[] {
  const completed = (id: string, toolName: string): AppMessagePart[] => [
    call(
      id,
      toolName,
      toolName.toLowerCase() === 'bash' ? { command: 'echo ok' } : { file_path: 'file.txt' }
    ),
    { type: 'tool_result', toolRunId: id, isError: false, result: 'ok' }
  ]
  const tool = backend === 'opencode' ? 'read' : 'Bash'
  const left = completed('a', tool)
  const right = completed('b', tool)
  if (['c2', 'o4', 'w3'].includes(name))
    return [msg('first', 'assistant', left), msg('next', 'assistant', [text(' '), ...right])]
  const gaps: Record<string, AppMessagePart[]> = {
    'c4-text': [text('visible')],
    'c4-reasoning': [{ type: 'reasoning', text: 'reason' }],
    'c4-ask': [call('ask', 'AskUserQuestion', { questions: [] })],
    'c4-error': [{ type: 'error', error }],
    'c4-compact': [{ type: 'compact_boundary' }],
    o2: [{ type: 'reasoning', text: 'hidden' }],
    o3: completed('shell', 'bash'),
    c1: [text('\n\n')],
    o1: [text('\n')]
  }
  return [
    msg('first', 'assistant', [
      ...left,
      ...(gaps[name] ?? []),
      ...right,
      ...(name === 'c1' ? completed('read', 'Read') : [])
    ])
  ]
}
function fixture(): LoadedMessage[] {
  if (scenario?.startsWith('matrix-')) return toolMatrix(scenario.slice(7))
  if (scenario === 'errorRun' || scenario === 'errorLive') {
    return Array.from({ length: scenario === 'errorLive' ? 3 : 6 }, (_, i) => [
      msg('u' + i, 'user', [text('Question')]),
      msg(
        'a' + i,
        'assistant',
        agentKind === 'work' ? activity([], 'aborted') : [{ type: 'error', error }]
      )
    ]).flat()
  }
  if (scenario === 'editStat') {
    if (backend === 'opencode') {
      const patch = '--- a/a.txt\n+++ b/a.txt\n@@ -0,0 +1,15000 @@\n' + lines(15000, '+line') + '\n'
      return [
        msg('a', 'assistant', [
          call('patch', 'apply_patch', {}),
          {
            type: 'tool_result',
            toolRunId: 'patch',
            result: 'ok',
            isError: false,
            structuredOutput: { files: [{ file: 'a.txt', patch }] }
          }
        ])
      ]
    }
    return [
      msg('a', 'assistant', [
        call('write', 'Write', { file_path: 'a', content: lines(654, 'new') }),
        call('edit', 'Edit', {
          file_path: 'b',
          old_string: lines(5000, 'old'),
          new_string: lines(5000, 'new')
        })
      ])
    ]
  }
  const tools = [
    call('A', 'Bash', { command: 'echo a' }),
    text(scenario === 'workNote' ? 'note' : '\n\n'),
    call('B', 'Bash', { command: 'echo b' })
  ]
  return [
    msg(
      'a',
      'assistant',
      agentKind === 'work' ? activity(tools) : [text('Before tools'), ...tools, text('After tools')]
    )
  ]
}

Object.assign(window, {
  oo: {
    session: {
      page: async ({ cursor }: { cursor: string }) => {
        const page = capture.before.find((p) => p.cursor === cursor)
        if (!page) throw Error('unexpected history cursor')
        return page.reply
      },
      load: async () =>
        accepted
          ? reopened
            ? capture.reopened
            : capture.initial
          : {
              id,
              backend,
              agentKind,
              title: id,
              messages: fixture(),
              complete: true
            },
      refresh: async () => ({ status: 'unchanged' })
    },
    settings: { set: async () => ({}) },
    chat: { backgroundState: async () => emptyBackgroundState() }
  }
})
const style = document.createElement('style')
style.textContent =
  appCss + '\nbody{margin:0}#root{height:100vh;display:flex;flex-direction:column}'
document.head.appendChild(style)
await chatActions.loadSession(id)
const root = createRoot(document.querySelector('#root')!)
function LayoutTranscript(): React.JSX.Element {
  const state = useChatStore((store) => store.sessions[id].session)
  return (
    <HarnessScrollController
      backend={backend}
      sessionKey={id}
      sessionId={id}
      messages={state.messages}
      sendCount={state.sendCount}
      inflight={state.inflight}
    >
      {(scroll) => (
        <TranscriptView
          {...scroll}
          backend={backend}
          agentKind={agentKind}
          messages={state.messages}
          pendingSteer={[]}
          error={state.error}
          inflight={state.inflight}
          loadingSession={false}
        />
      )}
    </HarnessScrollController>
  )
}
flushSync(() => root.render(<LayoutTranscript />))
const frame = (): Promise<void> =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const all = (s: string): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>(s))
const gap = (a: Element, b: Element): number =>
  b.getBoundingClientRect().top - a.getBoundingClientRect().bottom
const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1
const statHeads = (): string[] =>
  all('[data-focus-id="toggle"][aria-expanded="false"]').map((el) => el.textContent || '')
const startingStats = statHeads()
Object.assign(window, {
  async layoutMeasurement() {
    for (let i = 0; i < 5; i++) await frame()
    if (scenario?.startsWith('matrix-')) {
      const name = scenario.slice(7)
      const claude = all('[data-claude-tool-group]')
      const cards = all('[data-focus-id="toggle"]')
      const groups = all('[data-component="context-tool-group"]')
      const toolRows = all('[data-timeline-row="tools"]')
      const work = all('[data-work-tools]')
      const header = claude[0]?.querySelector('button')?.textContent ?? ''
      const ok =
        name === 'w3'
          ? work.length === 1
          : name.startsWith('o')
            ? name === 'o3'
              ? groups.length === 0 && toolRows.length === 3
              : groups.length === 1 && toolRows.length === 1
            : name.startsWith('c4')
              ? claude.length === 0 && cards.length >= 2
              : claude.length === 1 &&
                cards.length === (name === 'c1' ? 3 : 2) &&
                (name !== 'c1' || (header.includes('2') && header.includes('1')))
      return {
        ok,
        header,
        claude: claude.length,
        cards: cards.length,
        exploration: groups.length,
        toolRows: toolRows.length,
        work: work.length
      }
    }
    if (accepted) return measureAccepted(reopened)
    if (scenario === 'errorLive') {
      const gaps: number[] = []
      const counts: number[] = []
      const stored: number[] = []
      for (let i = 0; i < 3; i++) {
        flushSync(() => {
          useChatStore.setState((s) => {
            const entry = s.sessions[id]
            const session = chatReducer(entry.session, {
              type: 'APPEND_COMMITTED_USER_MESSAGE',
              text: 'Question',
              messageKey: 'latest' + i
            })
            return { sessions: { ...s.sessions, [id]: { ...entry, session } } }
          })
          ingestChatEvent({ type: 'error', sessionId: id, error })
        })
        await frame()
        const errors = all('[data-transcript-error]')
        counts.push(errors.length)
        stored.push(
          useChatStore
            .getState()
            .sessions[id].session.messages.filter((message) =>
              message.parts.some((part) => part.type === 'error')
            ).length
        )
        if (errors.length >= 2) gaps.push(gap(errors.at(-2)!, errors.at(-1)!))
      }
      return {
        ok: counts.join(',') === '4,4,4' && stored.every((n) => n === 3),
        counts,
        stored,
        gaps
      }
    }
    if (scenario === 'errorRun') {
      const measure = (): { ok: boolean; rows: number; gaps: number[] } => {
        const rows = all('[data-transcript-error]')
        const gaps = rows.slice(1).map((node, i) => gap(rows[i], node))
        const legacy = rows.every((row) =>
          agentKind === 'work'
            ? row.dataset.responseOutcome === 'aborted' && Boolean(row.innerText.trim())
            : row.innerText.includes(error.message) && !row.dataset.failureId
        )
        return {
          ok: legacy && rows.length === 6 && Math.max(...gaps) - Math.min(...gaps) <= 1,
          gaps,
          rows: rows.length
        }
      }
      const initial = measure()
      for (const event of capture.steps.at(-1)!.events) {
        if ('sessionId' in event) ingestChatEvent({ ...event, sessionId: id })
      }
      await scrollToPosition('middle')
      const next = measure()
      await scrollToPosition('bottom')
      const hasSuccess = document.body.innerText.includes(capture.success)
      return { ok: initial.ok && next.ok && hasSuccess, initial, next, hasSuccess }
    }
    if (scenario === 'editStat') {
      const ok = (values: string[]): boolean =>
        backend === 'opencode'
          ? values.some((v) => v.includes('+15000'))
          : values.some((v) => v.includes('+654')) &&
            values.some((v) => v.includes('+5000') && v.includes('-5000'))
      for (let i = 0; !ok(statHeads()) && i < 900; i++) await frame()
      const final = statHeads()
      return { ok: ok(final) && !ok(startingStats), final, startingStats }
    }
    if (agentKind === 'work') {
      all('[data-work-activity] > button')[0]?.click()
      await frame()
      const rows = all('[data-work-tool] > button')
      const notes = all('[data-work-note] .rounded-full')
      const shell = all('[data-work-tool] > span[aria-hidden]')[1]?.getBoundingClientRect()
      const dots = all('[data-work-activity] .rounded-full').filter((el) => {
        const rect = el.getBoundingClientRect()
        return shell && rect.bottom <= shell.top && rect.bottom >= shell.top - 20
      }).length
      const spacing = rows.length === 2 ? gap(rows[0], rows[1]) : null
      return {
        ok:
          rows.length === 2 &&
          (scenario === 'workNote'
            ? notes.length === 1
            : notes.length === 0 && dots === 0 && near(spacing!, 8)),
        dots,
        notes: notes.length,
        spacing
      }
    }
    const rows = all('[data-index]')
    const group = all('[data-claude-tool-group]')[0]
    const cards = all('[data-claude-tool-group] [data-focus-id="toggle"]')
    if (!group || cards.length !== 2 || rows.length < 3)
      return { ok: false, rows: rows.length, cards: cards.length }
    const gaps = [
      gap(rows[0].lastElementChild!, group),
      gap(group, rows[2].firstElementChild!),
      gap(cards[0], cards[1])
    ]
    return { ok: gaps.every((v, i) => near(v, [12, 12, 4][i])), gaps }
  }
})
