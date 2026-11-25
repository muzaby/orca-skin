import { createElement } from 'react'
import { expect, it, vi } from 'vitest'
import type { HistoryPageReply } from '../../../../../../shared/history-page'
import type { LoadedMessage } from '../../../../../../shared/ipc'
import { panelRows, sourceKey, type PanelItem } from '../../../../../../shared/history-panels/rows'
import { TranscriptPanelProjection } from '../../../../../../shared/history-panels/projection'
import { installFakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { sessionApi } from '../../../../shared/api/ipc'
import { initialChatState, fromLoadedMessage } from '../../reducer/chatReducer'
import { useChatStore, useTranscriptView } from '../../store/chatStore'
import { HistoryPanelBoundary } from '../../harnesses/common/rightpanel/HistoryPanelBoundary'
import { mergePanelView, SessionPanels } from '../../store/historyPanels'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('zustand', async () => {
  const { createStore } = await import('zustand/vanilla')
  const { fakeHooks } = await import('../../../../shared/ui/renderHarness.testfixture')
  const useStore = <T, U>(store: import('zustand').StoreApi<T>, choose: (s: T) => U): U =>
    fakeHooks.useSyncExternalStore(store.subscribe, () => choose(store.getState())) as U
  const bind = <T>(
    init: import('zustand').StateCreator<T>
  ): import('zustand').StoreApi<T> & ((choose: (s: T) => unknown) => unknown) => {
    const store = createStore(init)
    return Object.assign((choose: (s: T) => unknown) => useStore(store, choose), store)
  }
  return {
    create: (init?: import('zustand').StateCreator<unknown>) => (init ? bind(init) : bind),
    useStore
  }
})
vi.mock('../../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../../shared/i18n')>()),
  useI18n: () => ({ tr: (key: string) => key })
}))

function Consumer(): React.JSX.Element {
  const tasks = useTranscriptView('taskBoard')
  const sources = useTranscriptView('taskContextSources')
  const agents = useTranscriptView('subagentTasks')
  const model = useTranscriptView('sessionPanelModel')
  const child = useTranscriptView('childMessage', 'agent')
  return createElement('div', {
    'data-panels': JSON.stringify([
      tasks.map((t) => [t.id, t.status]),
      sources.map(sourceKey),
      agents.map((a) => a.description),
      model.processes.map((p) => p.command),
      child?.parts
    ])
  })
}

it('all session panels show unpublished live changes over a historical summary, and fetch one child detail', async () => {
  vi.useFakeTimers()
  const dom = installFakeDom({ innerWidth: 1000, innerHeight: 700 })
  const original = useChatStore.getState()
  const scope = { sessionId: 'S', generation: 'g', openGeneration: 4 }
  const historical: LoadedMessage = {
    id: '17',
    role: 'assistant',
    createdAt: 17,
    parts: [
      { type: 'tool_call', toolName: 'TaskCreate', toolRunId: 'c', args: { subject: 'work' } },
      {
        type: 'tool_result',
        toolRunId: 'c',
        isError: false,
        result: '',
        structuredOutput: { task: { id: '7' } }
      },
      {
        type: 'tool_call',
        toolName: 'Agent',
        toolRunId: 'agent',
        args: { description: 'old agent' }
      },
      { type: 'text', parentToolRunId: 'agent', text: 'child text' },
      { type: 'tool_call', toolName: 'Read', toolRunId: 'read', args: { file_path: '/old/file' } },
      { type: 'tool_result', toolRunId: 'read', isError: false, result: '' },
      {
        type: 'tool_call',
        toolName: 'Bash',
        toolRunId: 'process',
        args: { command: 'old command' }
      }
    ]
  }
  const frontier = fromLoadedMessage({
    id: '100',
    role: 'user',
    createdAt: 100,
    parts: [{ type: 'text', text: 'latest only' }]
  })
  const live: LoadedMessage = {
    id: '101',
    role: 'assistant',
    createdAt: 101,
    parts: [
      {
        type: 'tool_call',
        toolName: 'TaskUpdate',
        toolRunId: 'u',
        args: { taskId: '7', status: 'completed' }
      },
      {
        type: 'tool_result',
        toolRunId: 'u',
        isError: false,
        result: '',
        structuredOutput: { success: true, taskId: '7', updatedFields: ['status'] }
      }
    ]
  }
  const projection = new TranscriptPanelProjection()
  projection.reset([historical, frontier])
  const rows = [...panelRows(projection)]
  let fail = true
  const query = vi
    .spyOn(sessionApi, 'page')
    .mockImplementation(async (req): Promise<HistoryPageReply> => {
      const echo = { ...scope, requestId: 1 }
      if (req.kind === 'panelSummary') {
        if (req.panel === 'agents' && fail) {
          fail = false
          return { ...echo, status: 'unavailable' }
        }
        const data = rows
          .filter((r) => r.summary.kind === req.panel)
          .map(({ key, summary }) => ({ key, value: summary }))
        return {
          ...echo,
          status: 'panelSummary',
          checkpoint: 199,
          frontier: { key: '100', parts: 1 },
          panel: req.panel,
          rows: data,
          total: data.length
        }
      }
      if (req.kind !== 'panelDetail') throw Error(req.kind)
      const detail = rows.find((r) => r.key === req.itemKey)?.detail
      const bytes = Buffer.from(JSON.stringify(detail))
      return {
        ...echo,
        status: 'panelDetail',
        itemKey: req.itemKey,
        checkpoint: 199,
        panel: req.panel,
        base64: bytes.toString('base64'),
        offset: 0,
        nextOffset: bytes.length,
        done: true
      }
    })
  try {
    useChatStore.setState({
      activeKey: 'S',
      sessions: {
        S: {
          history: scope,
          session: {
            ...initialChatState,
            sessionId: 'S',
            historyComplete: false,
            messages: [frontier, live]
          },
          live: { text: '', reasoning: '', reasoningVisible: false },
          subagentMeta: {}
        }
      }
    })
    dom.render(
      createElement(
        HistoryPanelBoundary,
        {
          id: 'task',
          backend: 'opencode'
        },
        createElement(Consumer)
      )
    )
    expect(dom.query('[role="status"]')).toBeTruthy()
    await vi.waitFor(() => {
      dom.act(() => {})
      expect(dom.query('[role="alert"]')).toBeTruthy()
    })
    dom.click(dom.query('[type="button"]')!)
    await vi.waitFor(() => {
      dom.act(() => {})
      const value = dom.query('[data-panels]')?.props['data-panels']
      expect(value && JSON.parse(String(value))).toEqual([
        [['7', 'completed']],
        ['file:/old/file'],
        ['old agent'],
        ['old command'],
        [{ type: 'text', text: 'child text' }]
      ])
    })
    expect(query.mock.calls.filter(([q]) => q.kind === 'panelDetail')).toHaveLength(1)
    expect(useChatStore.getState().sessions.S.session.messages.map((m) => m.id)).toEqual([
      '100',
      '101'
    ])
  } finally {
    dom.unmount()
    query.mockRestore()
    useChatStore.setState(original, true)
    vi.unstubAllGlobals()
    vi.useRealTimers()
  }
})

it('retrieves the next keyset on demand and rejects stale detail after a session publication', async () => {
  const scope = { sessionId: 'S', generation: 'g', openGeneration: 1 }
  const row = (id: string): { key: string; value: PanelItem } => ({
    key: 'agent:' + id,
    value: {
      kind: 'tasks',
      item: {
        id,
        key: 'agent:' + id,
        title: id,
        subject: id,
        description: null,
        blockedBy: [],
        status: 'pending'
      }
    }
  })
  const echo = { ...scope, requestId: 1, checkpoint: 2, panel: 'tasks' as const, total: 2 }
  let finish!: (r: HistoryPageReply) => void
  const api = vi
    .fn()
    .mockResolvedValueOnce({ ...echo, status: 'panelSummary', rows: [row('1')], next: 'cursor' })
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          finish = r
        })
    )
    .mockResolvedValueOnce({ ...echo, status: 'panelSummary', rows: [row('2')] })
  const store = new SessionPanels(scope, api)
  await store.read('tasks')
  const pending = store.detail('tasks', 'agent:1')
  await store.read('tasks', true)
  expect(store.snapshot().tasks.rows.map((r) => r.key)).toEqual(['agent:1', 'agent:2'])
  store.invalidate()
  finish({ ...echo, status: 'stale' })
  await pending
  expect(store.snapshot().tasks.rows).toEqual([])
  expect(api).toHaveBeenCalledTimes(3)
})

it('folds only parts beyond the published frontier into live agents, processes and context sources', async () => {
  const scope = { sessionId: 's', generation: 'g', openGeneration: 1 }
  const calls = (label: string): LoadedMessage['parts'] => [
    {
      type: 'tool_call',
      toolRunId: 'agent-' + label,
      toolName: 'Agent',
      args: { description: label }
    },
    { type: 'tool_call', toolRunId: 'bash-' + label, toolName: 'Bash', args: { command: label } },
    {
      type: 'tool_call',
      toolRunId: 'read-' + label,
      toolName: 'Read',
      args: { file_path: '/file/' + label }
    },
    { type: 'tool_result', toolRunId: 'read-' + label, result: 'ok', isError: false }
  ]
  const messages: LoadedMessage[] = [
    { id: 'old', role: 'assistant', createdAt: 0, parts: calls('old') },
    {
      id: 'boundary',
      role: 'assistant',
      createdAt: 1,
      parts: [...calls('prefix'), ...calls('suffix')]
    },
    { id: 'new', role: 'assistant', createdAt: 2, parts: calls('live') }
  ]
  const panels = new SessionPanels(scope, async (q) => {
    if (q.kind !== 'panelSummary') throw Error(q.kind)
    return {
      ...scope,
      requestId: 1,
      status: 'panelSummary',
      panel: q.panel,
      frontier: { key: 'boundary', parts: 4 },
      checkpoint: 3,
      total: 0,
      rows: []
    }
  })
  for (const panel of ['agents', 'sources', 'processes'] as const) await panels.read(panel)
  const live = new TranscriptPanelProjection()
  live.reset(messages)
  const view = (domain: string): unknown =>
    mergePanelView(domain, undefined, panels.snapshot(), live, messages)
  expect(view('subagentTasks')).toEqual(
    ['suffix', 'live'].map((description) => expect.objectContaining({ description }))
  )
  expect(view('sessionPanelModel')).toMatchObject({
    processes: ['suffix', 'live'].map((command) => expect.objectContaining({ command }))
  })
  expect(view('taskContextSources')).toEqual(
    ['suffix', 'live'].map((label) => expect.objectContaining({ path: '/file/' + label }))
  )
})

it('rejects off-list and malformed details, restarts a stale continuation and discards superseded summary results', async () => {
  const scope = { sessionId: 's', generation: 'g', openGeneration: 1 }
  const echo = { ...scope, requestId: 1, panel: 'tasks' as const, checkpoint: 1 }
  const value: PanelItem = {
    kind: 'tasks',
    item: {
      id: '1',
      key: '1',
      title: 'title',
      subject: 'subject',
      description: null,
      blockedBy: [],
      status: 'pending'
    }
  }
  const ok = { ...echo, status: 'panelSummary', rows: [{ key: 'task', value }], total: 1 }
  const api = vi.fn().mockResolvedValueOnce({ ...ok, next: 'cursor' })
  const store = new SessionPanels(scope, api)
  await store.read('tasks')
  expect(store.detail('tasks', 'absent')).toBeUndefined()
  expect(api).toHaveBeenCalledTimes(1)
  const bytes = Buffer.from(JSON.stringify(value))
  const detail = {
    ...echo,
    status: 'panelDetail',
    itemKey: 'task',
    offset: 0,
    nextOffset: bytes.length,
    base64: bytes.toString('base64'),
    done: true
  }
  const callsBeforeDetail = api.mock.calls.length
  api.mockResolvedValueOnce({ ...detail, nextOffset: bytes.length + 1, done: false })
  await store.detail('tasks', 'task')
  expect(store.snapshot().tasks.state).toBe('failed')
  expect(api.mock.calls.length - callsBeforeDetail).toBe(1)
  const other = Buffer.from(
    JSON.stringify({ kind: 'sources', item: { kind: 'file', path: '/other' } })
  )
  api.mockResolvedValueOnce({
    ...detail,
    base64: other.toString('base64'),
    nextOffset: other.length
  })
  await store.detail('tasks', 'task')
  expect(store.snapshot().tasks.rows[0].value).toEqual(value)
  api
    .mockResolvedValueOnce({ ...echo, status: 'stale' })
    .mockResolvedValueOnce({ ...ok, checkpoint: 2 })
  await store.read('tasks', true)
  expect(api.mock.calls.slice(-2).map(([q]) => q.cursor)).toEqual(['cursor', undefined])
  expect(store.snapshot().tasks.checkpoint).toBe(2)
  store.invalidate()
  let finish!: (r: HistoryPageReply) => void
  api.mockReturnValueOnce(
    new Promise((r) => {
      finish = r
    })
  )
  const pending = store.read('tasks')
  store.invalidate()
  finish({ ...echo, status: 'panelSummary', total: 1, rows: [{ key: 'late', value }] })
  await pending
  expect(store.snapshot().tasks.state).toBe('initial')
})
