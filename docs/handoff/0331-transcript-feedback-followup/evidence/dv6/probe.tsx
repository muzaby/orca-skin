import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { AppMessagePart, LoadedMessage } from '../../src/shared/ipc'
import { emptyBackgroundState } from '../../src/shared/background-task'
import { chatActions, useChatStore } from '@renderer/features/chat/store/chatStore'
import { HarnessScrollController } from '@renderer/features/chat/components/transcript/HarnessScrollController'
import { TranscriptView } from '@renderer/features/chat/components/transcript/TranscriptView'
import appCss from '@renderer/styles/app.css?inline'

const query = new URLSearchParams(location.search)
const [backend, agentKind] = query.get('screen')!.split('-') as ['claude' | 'opencode', 'code' | 'work']
const scenario = query.get('scenario')!
const id = 'scratch-' + scenario
const text = (text: string): AppMessagePart => ({ type: 'text', text })
const call = (toolRunId: string, toolName: string, args: unknown): AppMessagePart => ({
  type: 'tool_call',
  toolRunId,
  toolName,
  args
})
const result = (toolRunId: string, r: string): AppMessagePart => ({
  type: 'tool_result',
  toolRunId,
  isError: false,
  result: r
})
const msg = (
  id: string,
  role: 'user' | 'assistant',
  parts: AppMessagePart[],
  createdAt = 1
): LoadedMessage => ({ id, role, parts, createdAt })
const begin = (rid: string): AppMessagePart =>
  ({ type: 'response_boundary', boundary: { phase: 'begin', id: rid } }) as AppMessagePart
const end = (rid: string, outcome: string): AppMessagePart =>
  ({ type: 'response_boundary', boundary: { phase: 'end', id: rid, outcome } }) as AppMessagePart
const tsSource = Array.from(
  { length: 12 },
  (_, i) => `${String(i + 1).padStart(6)}→const value${i}: number = ${i} // comment`
).join('\n')

function fixture(): LoadedMessage[] {
  if (scenario === 'tools') {
    return [
      msg('u1', 'user', [text('Please read')]),
      msg('a1', 'assistant', [
        text('Reading files.'),
        call('r1', 'Read', { file_path: '/repo/src/a.ts' }),
        result('r1', tsSource),
        call('b1', 'Bash', { command: 'ls -la && echo "done"' }),
        result('b1', 'total 0\ndone'),
        call('e1', 'Edit', {
          file_path: '/repo/src/a.ts',
          old_string: 'const a = 1\n',
          new_string: 'const a = 2\n'
        }),
        result('e1', 'ok'),
        text('Done.')
      ])
    ]
  }
  if (scenario === 'workTools') {
    return [
      msg('u1', 'user', [text('Please read')]),
      msg('a1', 'assistant', [
        begin('w1'),
        text('Reading files.'),
        call('r1', 'Read', { file_path: '/repo/src/a.ts' }),
        result('r1', tsSource),
        call('b1', 'Bash', { command: 'ls -la && echo "done"' }),
        result('b1', 'total 0\ndone'),
        call('e1', 'Edit', {
          file_path: '/repo/src/a.ts',
          old_string: 'const a = 1\n',
          new_string: 'const a = 2\n'
        }),
        result('e1', 'ok'),
        text('Done.'),
        end('w1', 'ended')
      ])
    ]
  }
  if (scenario === 'workNotes') {
    const notes = [
      'visible note',
      '\u200b',
      '<!-- hidden -->',
      '[ref]: https://example.com',
      '&nbsp;',
      '\u2060\ufeff',
      '<br>',
      ('Long note paragraph. '.repeat(40) + '\n\n').repeat(6)
    ]
    const body: AppMessagePart[] = [begin('wn')]
    notes.forEach((note, i) => {
      body.push(call('t' + i, 'Bash', { command: 'echo ' + i }), result('t' + i, 'ok ' + i))
      body.push(text(note))
    })
    body.push(call('tz', 'Bash', { command: 'echo end' }), result('tz', 'ok'), text('Done.'))
    body.push(end('wn', 'ended'))
    return [msg('u1', 'user', [text('notes')]), msg('a1', 'assistant', body)]
  }
  if (scenario === 'emptyReasoning') {
    return [
      msg('u1', 'user', [text('q')]),
      msg('a1', 'assistant', [
        { type: 'reasoning', text: '' } as AppMessagePart,
        text('answer after empty reasoning')
      ])
    ]
  }
  if (scenario === 'pendingAsk') {
    return [
      msg('u1', 'user', [text('q')]),
      msg('a1', 'assistant', [
        text('Let me ask'),
        call('ask1', 'AskUserQuestion', {
          questions: [{ question: 'Pick?', header: 'h', options: [{ label: 'a' }, { label: 'b' }] }]
        })
      ])
    ]
  }
  if (scenario === 'ocReasoning') {
    return [
      msg('u1', 'user', [text('q')]),
      msg('a1', 'assistant', [
        { type: 'reasoning', text: 'thinking hard' } as AppMessagePart,
        text('answer after reasoning')
      ])
    ]
  }
  if (scenario === 'longMd') {
    const section = (i: number): string =>
      `## Section ${i}\n\n- item **bold ${i}**\n- item \`code ${i}\`\n\n` +
      'Paragraph text that is long enough to add bulk. '.repeat(8) +
      `\n\n\`\`\`ts\nconst value${i} = ${i}\n\`\`\`\n\n| a | b |\n|---|---|\n| ${i} | ${i + 1} |\n\n`
    return [
      msg('u1', 'user', [text('long')]),
      msg('a1', 'assistant', [
        text('# Long answer\n\n' + Array.from({ length: 30 }, (_, i) => section(i)).join(''))
      ])
    ]
  }
  if (scenario === 'markdown') {
    return [
      msg('u1', 'user', [text('md')]),
      msg('a1', 'assistant', [
        text(
          '# Title\n\n- item **bold**\n- item `code`\n\n```ts\nconst x = 1\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n'
        )
      ])
    ]
  }
  const turns: LoadedMessage[] = []
  for (let i = 0; i < 4; i++) {
    turns.push(msg('u' + i, 'user', [text('Question ' + i)], 10 + i * 2))
    const rid = 'rb' + i
    let parts: AppMessagePart[]
    if (scenario === 'abortEmpty') parts = [begin(rid), end(rid, 'aborted')]
    else if (scenario === 'abortText') parts = [begin(rid), text('partial answer'), end(rid, 'aborted')]
    else if (scenario === 'abortTool')
      parts = [begin(rid), call('t' + i, 'Bash', { command: 'sleep 1' }), end(rid, 'aborted')]
    else if (scenario === 'abortNoEnd') parts = [begin(rid)]
    else if (scenario === 'abortTwice')
      parts = [begin(rid), end(rid, 'aborted'), begin(rid + 'b'), end(rid + 'b', 'ended')]
    else parts = [begin(rid), text('answer'), end(rid, 'ended')]
    turns.push(msg('a' + i, 'assistant', parts, 11 + i * 2))
  }
  return turns
}

const logs: string[] = []
const deferredParts: AppMessagePart[] = Array.from({ length: 150 }, (_, i) => [
  call('d' + i, 'Read', { file_path: '/repo/src/f' + i + '.ts' }),
  result('d' + i, tsSource.repeat(2))
]).flat()
const deferredBytes = new TextEncoder().encode(JSON.stringify(deferredParts))
const ref = {
  kind: 'parts' as const,
  session: id,
  generation: 'g1',
  message: 'big',
  bytes: deferredBytes.length
}
const pageCalls: unknown[] = []
function deferredSession(): unknown {
  return {
    id,
    backend,
    agentKind,
    title: id,
    complete: false,
    history: { generation: 'g1' },
    messages: [
      msg('u0', 'user', [text('big turn')]),
      { ...msg('big', 'assistant', []), deferredBody: ref },
      ...fixture()
    ]
  }
}
const toBase64 = (bytes: Uint8Array): string => {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
Object.assign(window, {
  oo: {
    session: {
      page: async (q: { kind: string; offset: number; openGeneration: number }) => {
        pageCalls.push({ kind: q.kind, offset: q.offset })
        if (q.kind !== 'body') throw Error('no page')
        const end = Math.min(deferredBytes.length, q.offset + 64 * 1024)
        return {
          status: 'body',
          sessionId: id,
          requestId: 0,
          openGeneration: q.openGeneration,
          offset: q.offset,
          nextOffset: end,
          done: end === deferredBytes.length,
          base64: toBase64(deferredBytes.subarray(q.offset, end))
        }
      },
      load: async () =>
        query.get('deferred')
          ? deferredSession()
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
    log: { emit: (x: unknown) => logs.push(JSON.stringify(x)) },
    chat: { backgroundState: async () => emptyBackgroundState() }
  }
})
const style = document.createElement('style')
style.textContent =
  appCss + '\nbody{margin:0}#root{height:100vh;display:flex;flex-direction:column}'
document.head.appendChild(style)
await chatActions.loadSession(id)
const root = createRoot(document.querySelector('#root')!)
function T(): React.JSX.Element {
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
flushSync(() => root.render(<T />))
Object.assign(window, {
  async dropTest(cancelDiff: boolean) {
    const { computeClient } = await import('@renderer/shared/compute/client')
    const client = computeClient()
    const many = (n: number, p: string): string =>
      Array.from({ length: n }, (_, i) => p + i + ' ' + 'x'.repeat(i % 50)).join('\n')
    const oldRef = { id: 'old-' + cancelDiff, revision: 1 }
    const newRef = { id: 'new-' + cancelDiff, revision: 1 }
    const l1 = client.openDocument(oldRef, { text: many(4000, 'a') }, 'compute')
    const l2 = client.openDocument(newRef, { text: many(4000, 'b') }, 'compute')
    const total = deferredBytes.length
    const seq = cancelDiff ? 9001 : 9002
    const chunk = (offset: number): { offset: number; base64: string } => ({
      offset,
      base64: toBase64(deferredBytes.subarray(offset, Math.min(total, offset + 65536)))
    })
    const steps: string[] = []
    const r0 = client.request(
      { kind: 'historyBody', sequence: seq, bytes: total, packet: chunk(0) },
      { cacheable: false }
    )
    steps.push('chunk0:' + (await r0.promise.then((r) => 'next=' + r.nextOffset, (e) => 'ERR ' + e)))
    const dv = client.request({
      kind: 'diffView',
      source: { kind: 'pair', old: oldRef, new: newRef },
      options: { ignoreWhitespace: false, layout: 'inline', highlightWords: false, expansions: [] },
      start: 0,
      end: 50
    })
    const other = client.request({
      kind: 'highlight',
      code: 'const a = ' + seq + ' // unique',
      lang: 'typescript',
      theme: 'github-light'
    })
    if (cancelDiff) dv.cancel()
    dv.promise.catch(() => {})
    steps.push('other:' + (await other.promise.then(() => 'ok', (e) => 'ERR ' + e)))
    const r1 = client.request(
      { kind: 'historyBody', sequence: seq, bytes: total, packet: chunk(65536) },
      { cacheable: false }
    )
    steps.push('chunk1:' + (await r1.promise.then((r) => 'next=' + r.nextOffset, (e) => 'ERR ' + e)))
    l1.release()
    l2.release()
    return steps
  },
  notes() {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-work-note]')).map((el) => {
      const content = el.lastElementChild as HTMLElement | null
      const r = el.getBoundingClientRect()
      const c = content?.getBoundingClientRect()
      return {
        rowH: Math.round(r.height * 10) / 10,
        contentTag: content?.tagName,
        contentH: c ? Math.round(c.height * 10) / 10 : null,
        text: JSON.stringify((el.innerText || '').slice(0, 30)),
        pending: el.querySelectorAll('[data-md-block-pending]').length,
        error: el.querySelectorAll('[data-md-block-error]').length
      }
    })
  },
  report() {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-index]')).map((el) => {
      const r = el.getBoundingClientRect()
      return {
        index: el.dataset.index,
        children: el.childElementCount,
        h: Math.round(r.height * 10) / 10,
        top: Math.round(r.top),
        cls: el.className.slice(0, 90),
        text: (el.innerText || '').slice(0, 40).replace(/\n/g, ' | ')
      }
    })
    return {
      rows,
      shiki: document.querySelectorAll('.shiki').length,
      lineSpans: document.querySelectorAll('.line').length,
      pres: Array.from(document.querySelectorAll('pre')).map((p) => ({
        cls: p.className.slice(0, 60),
        font: getComputedStyle(p).fontFamily.slice(0, 40),
        text: (p.textContent || '').slice(0, 30)
      })),
      h1: document.querySelectorAll('h1').length,
      h2: document.querySelectorAll('h2').length,
      mdError: document.querySelectorAll('[data-md-block-error]').length,
      deferred: Array.from(document.querySelectorAll('[data-history-body]')).map(
        (el) => (el as HTMLElement).innerText
      ),
      pageCalls,
      bigParts: useChatStore.getState().sessions[id].session.messages.find((m) => m.id === 'big')
        ?.parts.length,
      mdPending: document.querySelectorAll('[data-md-block-pending]').length,
      tables: document.querySelectorAll('table').length,
      logs
    }
  }
})
