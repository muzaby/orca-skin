import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  HistoryPageReply,
  HistoryLocator,
  HistoryEdge
} from '../../../../../shared/history-page'
import { chatActions, useChatStore, type SessionEntry } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { sessionApi } from '../../../shared/api/ipc'

import { saveSearchPosition } from '../lib/transcript/viewport/searchVisit'

const locator = (session: string, key = 'm:2'): HistoryLocator => ({
  v: 1,
  session,
  source: 'local',
  identity: key,
  projectedKey: key,
  epoch: 'e'
})
const originAnchor = {
  messageId: 'm:1',
  blockKey: 'b1',
  partKey: 'p',
  partIndex: 0,
  blockIndex: 0,
  charOffset: 27,
  viewportOffsetPx: -9,
  followingPartKeys: [],
  followingBlockKeys: [],
  precedingBlockKeys: new Set<string>()
}
const edge = (kind: 'earlierTurn' | 'laterTurn'): HistoryEdge => ({ kind, cursor: kind })
function reply(
  session: string,
  ids: string[],
  before = false,
  after = false
): Extract<HistoryPageReply, { status: 'ok' }> {
  return {
    status: 'ok',
    sessionId: session,
    requestId: 1,
    openGeneration: 1,
    targetMessage: ids[0],
    session: {
      id: session,
      title: null,
      agentKind: 'work',
      backend: 'claude',
      complete: false,
      messages: ids.map((id) => ({
        id,
        role: 'user',
        createdAt: 1,
        parts: [{ type: 'text', text: id }]
      })),
      history: {
        generation: 'g',
        ...(before ? { before: edge('earlierTurn') } : {}),
        ...(after ? { after: edge('laterTurn') } : {})
      }
    }
  }
}
const entry = (id = 'b'): SessionEntry => useChatStore.getState().sessions[id]
beforeEach(() => {
  installChatStoreHarness()
})
afterEach(() => {
  chatActions.cancelSearchRequest()
  vi.restoreAllMocks()
})
describe('search history in the chat store', () => {
  it('opens a cold target without latest, pages independently, joins the latest end and reuses a confirmed key', async () => {
    const page = vi.spyOn(sessionApi, 'page').mockResolvedValueOnce(reply('b', ['m:2'], true, true))
    const full = vi.spyOn(sessionApi, 'load')
    expect(await chatActions.openSearchHit(locator('b'), true)).toBe(true)
    expect(entry().session.messages).toEqual([])
    expect(entry().search?.view?.messages.map((m) => m.id)).toEqual(['m:2'])
    page.mockResolvedValueOnce(reply('b', ['m:1'], false, true))
    expect(chatActions.readSearchEdge('b', 'before')).toBe(true)
    expect(chatActions.readSearchEdge('b', 'before')).toBe(false)
    await Promise.resolve()
    expect(entry().search?.view?.before).toBeUndefined()
    page.mockResolvedValueOnce(reply('b', ['m:3'], true, false))
    expect(chatActions.readSearchEdge('b', 'after')).toBe(true)
    await Promise.resolve()
    expect(entry().search?.view).toBeUndefined()
    expect(entry().session.messages.map((m) => m.id)).toEqual(['m:1', 'm:2', 'm:3'])
    expect(entry().session.historyComplete).toBe(true)
    page.mockResolvedValueOnce({
      status: 'useCached',
      sessionId: 'b',
      openGeneration: 4,
      requestId: 4,
      generation: 'g',
      messageKey: 'm:2'
    })
    const previous = entry().search?.seq
    expect(await chatActions.openSearchHit(locator('b'), false)).toBe(true)
    expect(page.mock.calls.at(-1)?.[0]).toMatchObject({
      kind: 'target',
      cached: { generation: 'g', messageKey: 'm:2' }
    })
    expect(entry().search?.seq).not.toBe(previous)
    expect(full).not.toHaveBeenCalled()
  })
  it.each(['before', 'after'] as const)(
    'does not issue an automatic page while the %s search edge is pending',
    async (first) => {
      const initial = reply('b', ['m:2'])
      initial.session.history.before = { kind: 'withinTurn', cursor: 'left' }
      initial.session.history.after = { kind: 'withinTurn', cursor: 'right' }
      const page = vi.spyOn(sessionApi, 'page').mockResolvedValue(initial)
      await chatActions.openSearchHit(locator('b'), false)
      let deliver!: (value: HistoryPageReply) => void
      page.mockReturnValueOnce(
        new Promise((resolve) => {
          deliver = resolve
        })
      )
      expect(chatActions.readSearchEdge('b', first)).toBe(true)
      const opposite = first === 'before' ? 'after' : 'before'
      expect(chatActions.readSearchEdge('b', opposite, true)).toBe(false)
      expect(page).toHaveBeenCalledTimes(2)
      const next = reply('b', [first === 'before' ? 'm:1' : 'm:3'], true, true)
      next.session.history[opposite] = initial.session.history[opposite]
      deliver(next)
      await Promise.resolve()
      page.mockResolvedValueOnce(reply('b', ['final']))
      expect(chatActions.readSearchEdge('b', opposite, true)).toBe(true)
      expect(page).toHaveBeenCalledTimes(3)
      await Promise.resolve()
    }
  )

  it.each(['before', 'after'] as const)(
    'automatically reads only the healthy side after a %s error',
    async (failed) => {
      const initial = reply('b', ['m:2'])
      initial.session.history.before = { kind: 'withinTurn', cursor: 'left' }
      initial.session.history.after = { kind: 'withinTurn', cursor: 'right' }
      const page = vi.spyOn(sessionApi, 'page').mockResolvedValueOnce(initial)
      await chatActions.openSearchHit(locator('b'), false)
      page.mockRejectedValueOnce(Error('offline'))
      expect(chatActions.readSearchEdge('b', failed)).toBe(true)
      await Promise.resolve()
      expect(chatActions.readSearchEdge('b', failed, true)).toBe(false)
      expect(page).toHaveBeenCalledTimes(2)
      const healthy = failed === 'before' ? 'after' : 'before'
      page.mockResolvedValueOnce(reply('b', ['more'], true, true))
      expect(chatActions.readSearchEdge('b', healthy, true)).toBe(true)
      await Promise.resolve()
      expect(page.mock.calls.map(([q]) => q.kind)).toEqual(['target', 'withinTurn', 'withinTurn'])
      expect(entry().search?.view?.[failed === 'before' ? 'beforeState' : 'afterState']).toBe(
        'error'
      )
    }
  )
  it('allows a manual read on the other search edge while the first read is pending', async () => {
    const initial = reply('b', ['m:2'], true, true)
    const page = vi.spyOn(sessionApi, 'page').mockResolvedValueOnce(initial)
    await chatActions.openSearchHit(locator('b'), false)
    let finishBefore!: (value: HistoryPageReply) => void
    page.mockReturnValueOnce(
      new Promise((resolve) => {
        finishBefore = resolve
      })
    )
    page.mockResolvedValueOnce(reply('b', ['m:3'], true, true))
    expect(chatActions.readSearchEdge('b', 'before')).toBe(true)
    expect(chatActions.readSearchEdge('b', 'after')).toBe(true)
    await Promise.resolve()
    expect(entry().search?.view?.beforeState).toBe('loading')
    finishBefore(reply('b', ['m:1'], true, true))
    await Promise.resolve()
    expect(entry().search?.view?.messages.map((m) => m.id)).toEqual(['m:1', 'm:2', 'm:3'])
    expect(page.mock.calls.map(([query]) => query.kind)).toEqual([
      'target',
      'earlierTurn',
      'laterTurn'
    ])
  })

  it.each(['ordinary', 'before', 'after'] as const)(
    'rejects a different publication and retries the same %s cursor',
    async (direction) => {
      const ordinary = direction === 'ordinary'
      const side = direction === 'after' ? 'after' : 'before'
      const page = vi
        .spyOn(sessionApi, 'page')
        .mockResolvedValueOnce(reply('b', ['m:2'], true, !ordinary))
      await chatActions.openSearchHit(locator('b'), false)
      const request = (): boolean =>
        ordinary ? chatActions.readPrevious('b') : chatActions.readSearchEdge('b', side)
      const wrong = reply('b', ['foreign'])
      wrong.session.history.generation = 'other-generation'
      page.mockResolvedValue(wrong)
      expect(request()).toBe(true)
      expect(request()).toBe(false)
      expect(page).toHaveBeenCalledTimes(2)
      const originalQuery = page.mock.lastCall![0]
      await Promise.resolve()
      const current = ordinary ? entry().history : entry().search?.view
      expect(current).toMatchObject({
        generation: 'g',
        [side]: edge(side === 'before' ? 'earlierTurn' : 'laterTurn'),
        [side + 'State']: 'error'
      })
      expect(
        (ordinary ? entry().session.messages : entry().search!.view!.messages).map((m) => m.id)
      ).toEqual(['m:2'])
      page.mockResolvedValueOnce(reply('b', ['valid'], side === 'after', side === 'before'))
      expect(request()).toBe(true)
      expect(page.mock.lastCall![0]).toEqual(originalQuery)
      await Promise.resolve()
      expect(
        (entry().search?.view?.messages ?? entry().session.messages).map((m) => m.id)
      ).toContain('valid')
    }
  )
  it('discards an ordinary earlier page on session change without moving the inactive history cursor', async () => {
    const page = vi
      .spyOn(sessionApi, 'page')
      .mockResolvedValueOnce(reply('b', ['m:3'], true, false))
    await chatActions.openSearchHit(locator('b', 'm:3'), false)
    const cursor = entry().history!.before
    let deliver!: (value: HistoryPageReply) => void
    page.mockReturnValueOnce(
      new Promise((resolve) => {
        deliver = resolve
      })
    )
    expect(chatActions.readPrevious('b')).toBe(true)
    page.mockResolvedValueOnce(reply('c', ['m:c'], true, true))
    await chatActions.openSearchHit(locator('c', 'm:c'), false)
    deliver(reply('b', ['m:1']))
    await Promise.resolve()
    expect(entry('b').session.messages.map((m) => m.id)).toEqual(['m:3'])
    expect(entry('b').history?.before).toEqual(cursor)
    expect(useChatStore.getState().activeKey).toBe('c')
  })
  it('uses the parent cursor only for the fork draft and leaves the parent messages untouched', async () => {
    const parent = reply('s', ['m:2'], true, false)
    const page = vi.spyOn(sessionApi, 'page').mockResolvedValueOnce(parent)
    await chatActions.openSearchHit(locator('s'), false)
    expect(chatActions.startForkDraft()).toBe(true)
    const draft = useChatStore.getState().activeKey
    expect(draft).not.toBe('s')
    page.mockResolvedValueOnce(reply('s', ['m:1']))
    expect(chatActions.readPrevious(draft)).toBe(true)
    await Promise.resolve()
    expect(page.mock.calls.at(-1)?.[0]).toMatchObject({
      kind: 'earlierTurn',
      sessionId: 's',
      cursor: 'earlierTurn'
    })
    expect(
      entry(draft)
        .session.messages.slice(0, 2)
        .map((m) => m.id)
    ).toEqual(['m:1', 'm:2'])
    expect(entry('s').session.messages.map((m) => m.id)).toEqual(['m:2'])
    expect(entry(draft).session.historyComplete).toBe(true)
  })
  it('rechecks the source and restores the last reading anchor for that visit', async () => {
    const page = vi.spyOn(sessionApi, 'page').mockResolvedValueOnce(reply('b', ['m:2'], true, true))
    await chatActions.openSearchHit(locator('b'), false)
    const visit = entry().search!.seq
    const anchor = {
      messageId: 'm:1',
      blockKey: 'block',
      partKey: 'm:1:user',
      blockIndex: 0,
      partIndex: 0,
      charOffset: 14,
      viewportOffsetPx: -6,
      followingPartKeys: [],
      followingBlockKeys: [],
      precedingBlockKeys: new Set<string>()
    }
    saveSearchPosition(visit, 'b', 'g', anchor)
    page.mockResolvedValueOnce(reply('c', ['c:1'], true, true))
    await chatActions.openSearchHit(locator('c'), false)
    page.mockResolvedValueOnce(reply('b', ['m:1'], true, true))
    chatActions.restoreSearchVisit(locator('b'), visit)
    await vi.waitFor(() => expect(entry().search?.target).toBe('m:1'))
    expect(page).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: 'target',
        locator: locator('b'),
        resume: { generation: 'g', messageKey: 'm:1' }
      })
    )
    expect(entry().search).toMatchObject({ visit, anchor, restore: true, keyboard: false })
  })

  it('restores the ordinary pre-search visit at its reading offset without replaying a highlight', async () => {
    const page = vi.spyOn(sessionApi, 'page').mockResolvedValueOnce(reply('b', ['m:1'], true, true))
    chatActions.restoreOriginVisit(
      { session: 'b', generation: 'g', anchor: originAnchor, pinned: false },
      'default'
    )
    await vi.waitFor(() => expect(entry().search?.target).toBe('m:1'))
    expect(page).toHaveBeenCalledTimes(1)
    expect(page).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'visit', sessionId: 'b', messageKey: 'm:1', generation: 'g' })
    )
    expect(entry().search).toMatchObject({ anchor: originAnchor, restore: true, keyboard: false })
    expect(entry().search?.locator).toBeUndefined()
  })
  it('reads a bounded latest page for a cold search and preserves the view if returning fails', async () => {
    const page = vi.spyOn(sessionApi, 'page').mockResolvedValueOnce(reply('b', ['m:2'], true, true))
    await chatActions.openSearchHit(locator('b'), false)
    let fail!: (error: Error) => void
    page.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        fail = reject
      })
    )
    chatActions.leaveSearch('b', true)
    chatActions.leaveSearch('b', true)
    expect(entry().search?.returning).toBe(true)
    expect(page.mock.calls.map(([q]) => q.kind)).toEqual(['target', 'latest'])
    fail(Error('unavailable'))
    await Promise.resolve()
    await Promise.resolve()
    expect(entry().search?.returnFailed).toBe(true)
    expect(entry().search?.view?.messages[0].id).toBe('m:2')
    page.mockResolvedValueOnce(reply('b', ['m:8'], true, false))
    chatActions.leaveSearch('b', true)
    await Promise.resolve()
    expect(page.mock.calls.map((c) => c[0].kind)).toEqual(['target', 'latest', 'latest'])
    expect(entry().search).toBeUndefined()
    expect(entry().session.messages.map((m) => m.id)).toEqual(['m:8'])
  })
  it('takes over an unfinished ordinary open without leaving a loading placeholder', async () => {
    const waiting = entry('s')
    useChatStore.setState({
      sessions: {
        s: waiting,
        b: { ...waiting, session: { ...waiting.session, sessionId: 'b', loadingSession: true } }
      }
    })
    vi.spyOn(sessionApi, 'page').mockResolvedValueOnce(reply('b', ['m:2'], true, true))
    expect(await chatActions.openSearchHit(locator('b'), false)).toBe(true)
    expect(entry().session.loadingSession).toBe(false)
    expect(entry().search?.view?.messages[0].id).toBe('m:2')
  })
  it('drops a late or deleted target and leaves the current view in place', async () => {
    let resolve!: (v: HistoryPageReply) => void
    const page = vi.spyOn(sessionApi, 'page').mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      })
    )
    const pending = chatActions.openSearchHit(locator('b'), false)
    page.mockResolvedValueOnce(reply('c', ['m:3']))
    expect(await chatActions.openSearchHit(locator('c', 'm:3'), true)).toBe(true)
    resolve(reply('b', ['m:2']))
    expect(await pending).toBe(false)
    expect(entry('b')).toBeUndefined()
    expect(entry('c').session.messages.map((m) => m.id)).toEqual(['m:3'])
    page.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      })
    )
    const removed = chatActions.openSearchHit(locator('b'), false)
    chatActions.handleSessionDeleted('b')
    resolve(reply('b', ['m:2']))
    expect(await removed).toBe(false)
    expect(useChatStore.getState().activeKey).toBe('c')
  })
})

it.each(['generation', 'absent key', 'absent target'] as const)(
  'declines an inconsistent target response (%s)',
  async (problem) => {
    const page = vi.spyOn(sessionApi, 'page').mockResolvedValueOnce(reply('b', ['cached'], true))
    await chatActions.openSearchHit(locator('b', 'cached'), false)
    const before = entry()
    const response = reply('b', ['different'], true, true)
    response.targetMessage = 'absent'
    page.mockResolvedValueOnce(
      problem === 'absent target'
        ? response
        : {
            status: 'useCached',
            sessionId: 'b',
            requestId: 3,
            openGeneration: 3,
            generation: problem === 'generation' ? 'old' : 'g',
            messageKey: problem === 'absent key' ? 'absent' : 'cached'
          }
    )
    expect(await chatActions.openSearchHit(locator('b', 'absent'), false)).toBe(false)
    expect(page.mock.lastCall![0]).not.toHaveProperty('cached')
    expect(entry()).toBe(before)
  }
)

it.each(['search', 'ordinary', 'inactive'] as const)(
  'drops a late %s page when its original reader is superseded',
  async (mode) => {
    const search = mode === 'search'
    const seed = reply('b', ['tail'], true, search)
    const page = vi.spyOn(sessionApi, 'page').mockResolvedValueOnce(seed)
    await chatActions.openSearchHit(locator('b', 'tail'), false)
    let resolve!: (r: HistoryPageReply) => void
    page.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r
      })
    )
    expect(search ? chatActions.readSearchEdge('b', 'before') : chatActions.readPrevious('b')).toBe(
      true
    )
    if (mode === 'inactive') {
      useChatStore.setState({ activeKey: 'other' })
    } else {
      page.mockResolvedValueOnce(seed)
      await chatActions.openSearchHit(locator('b', 'tail'), false)
    }
    const before = entry('b')
    resolve(reply('b', ['obsolete']))
    await Promise.resolve()
    expect(entry('b')).toBe(before)
  }
)

it('keeps the original cursor and messages when an earlier page overlaps out of order', async () => {
  const page = vi.spyOn(sessionApi, 'page').mockResolvedValueOnce(reply('b', ['one', 'two'], true))
  await chatActions.openSearchHit(locator('b', 'one'), false)
  page.mockResolvedValueOnce(reply('b', ['two', 'one']))
  expect(chatActions.readPrevious('b')).toBe(true)
  await Promise.resolve()
  expect(entry().history).toMatchObject({ before: edge('earlierTurn'), beforeState: 'error' })
  expect(entry().session.messages.map((m) => m.id)).toEqual(['one', 'two'])
})

it.each(['other generation', 'rejected overlap'] as const)(
  'keeps a separate search view when latest cannot join (%s)',
  async (problem) => {
    const page = vi
      .spyOn(sessionApi, 'page')
      .mockResolvedValueOnce(reply('b', ['one', 'two'], true))
    await chatActions.openSearchHit(locator('b', 'one'), false)
    const ordinary = entry().history
    const candidate = reply('b', problem === 'other generation' ? ['new'] : ['two', 'one'], true)
    if (problem === 'other generation') candidate.session.history.generation = 'different'
    page.mockResolvedValueOnce(candidate)
    await chatActions.openSearchHit(locator('b', candidate.targetMessage), false)
    expect(entry().history).toBe(ordinary)
    expect(entry().search?.view?.messages.map((m) => m.id)).toEqual(
      candidate.session.messages.map((m) => m.id)
    )
    chatActions.leaveSearch('b', true)
    expect(entry().search).toBeUndefined()
    expect(page).toHaveBeenCalledTimes(2)
  }
)

it('cancels the old lookup and ordinary source and discards a late return-to-latest response', async () => {
  const cancel = vi.spyOn(sessionApi, 'cancelLoad')
  let first!: (r: HistoryPageReply) => void
  const page = vi.spyOn(sessionApi, 'page').mockReturnValueOnce(
    new Promise((r) => {
      first = r
    })
  )
  const stale = chatActions.openSearchHit(locator('b'), false)
  const sequence = page.mock.lastCall![0].openGeneration
  page.mockResolvedValueOnce(reply('b', ['target'], true, true))
  await chatActions.openSearchHit(locator('b'), false)
  expect(cancel).toHaveBeenCalledWith('b', sequence)
  expect(cancel).toHaveBeenCalledWith('s')
  first(reply('b', ['old']))
  expect(await stale).toBe(false)
  let latest!: (r: HistoryPageReply) => void
  page.mockReturnValueOnce(
    new Promise((r) => {
      latest = r
    })
  )
  chatActions.leaveSearch('b', true)
  page.mockResolvedValueOnce(reply('b', ['again'], true, true))
  await chatActions.openSearchHit(locator('b'), false)
  const current = entry()
  latest(reply('b', ['obsolete']))
  await Promise.resolve()
  expect(entry()).toBe(current)
})

it('publishes the ordinary window and start marker and cancels its source on session switch', async () => {
  const loaded = reply('b', ['only']).session
  const load = vi.spyOn(sessionApi, 'load').mockResolvedValue(loaded)
  const cancel = vi.spyOn(sessionApi, 'cancelLoad')
  await chatActions.loadSession('b')
  expect(entry().history).toMatchObject({ generation: 'g' })
  expect(entry().session.historyComplete).toBe(true)
  useChatStore.setState((s) => ({
    sessions: {
      ...s.sessions,
      b: { ...entry(), history: { ...entry().history!, sourceSessionId: 'source-parent' } }
    }
  }))
  load.mockResolvedValueOnce(reply('c', ['latest'], true).session)
  await chatActions.loadSession('c')
  expect(cancel).toHaveBeenCalledWith('source-parent')
  expect(entry('c').session.historyComplete).toBe(false)
})

it('clears a departing search while latest is pending and ignores its late reply', async () => {
  const page = vi.spyOn(sessionApi, 'page').mockResolvedValueOnce(reply('b', ['hit'], true, true))
  await chatActions.openSearchHit(locator('b', 'hit'), false)
  let finish!: (result: HistoryPageReply) => void
  page.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  chatActions.leaveSearch('b', true)
  expect(entry().search?.returning).toBe(true)
  vi.spyOn(sessionApi, 'load').mockResolvedValue(reply('s', ['ordinary']).session)
  await chatActions.loadSession('s')
  expect(useChatStore.getState().activeKey).toBe('s')
  expect(entry().search).toBeUndefined()
  const { session, history } = entry()
  finish(reply('b', ['late-latest']))
  await Promise.resolve()
  await Promise.resolve()
  expect(entry().session.messages).toBe(session.messages)
  expect(entry().history).toBe(history)
  expect(entry().search).toBeUndefined()
  expect(page.mock.calls.map(([q]) => q.kind)).toEqual(['target', 'latest'])
})

it('preserves the search view when revalidating the active session', async () => {
  vi.spyOn(sessionApi, 'page').mockResolvedValueOnce(reply('b', ['hit'], true, true))
  await chatActions.openSearchHit(locator('b', 'hit'), false)
  const search = entry().search
  const load = vi.spyOn(sessionApi, 'load').mockResolvedValue(reply('b', ['ordinary']).session)
  await chatActions.loadSession('b', null, { revalidate: true })
  expect(load).toHaveBeenCalledWith('b')
  expect(entry().search).toBe(search)
})

it.each([true, false])(
  'restores an origin visit with a pending latest read only for the active search (pinned=%s)',
  async (pinned) => {
    const page = vi.spyOn(sessionApi, 'page').mockResolvedValueOnce(reply('b', ['hit'], true, true))
    await chatActions.openSearchHit(locator('b', 'hit'), false)
    let finish!: (result: HistoryPageReply) => void
    page.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    const origin = { session: 'b', pinned }
    chatActions.restoreOriginVisit(origin, 'one')
    chatActions.restoreOriginVisit(origin, 'two')
    expect(page.mock.calls.map(([q]) => q.kind)).toEqual(['target', 'latest'])
    expect(entry().search?.returning).toBe(true)
    finish(reply('b', ['latest']))
    await Promise.resolve()
    expect(entry().session.messages.map((m) => m.id)).toEqual(['latest'])
    const load = vi.spyOn(sessionApi, 'load').mockResolvedValue(reply('s', ['origin']).session)
    chatActions.restoreOriginVisit({ session: 's', pinned }, 'other')
    expect(load).toHaveBeenCalledExactlyOnceWith('s')
    await Promise.resolve()
    expect(useChatStore.getState().activeKey).toBe('s')
    expect(page).toHaveBeenCalledTimes(2)
  }
)

it('reopens an inactive origin that still holds a search view after starting a new chat', async () => {
  const page = vi
    .spyOn(sessionApi, 'page')
    .mockResolvedValueOnce(reply('b', ['hit'], true, true))
    .mockResolvedValue(reply('b', ['latest']))
  await chatActions.openSearchHit(locator('b', 'hit'), false)
  chatActions.newChat()
  expect(useChatStore.getState().activeKey).not.toBe('b')
  expect(entry().search?.view).toBeDefined()
  const load = vi.spyOn(sessionApi, 'load').mockResolvedValue(reply('b', ['ordinary']).session)

  chatActions.restoreOriginVisit({ session: 'b', pinned: true }, 'back')
  expect(load).toHaveBeenCalledExactlyOnceWith('b')
  await Promise.resolve()
  expect(useChatStore.getState().activeKey).toBe('b')
  expect(entry().session.messages.map((message) => message.id)).toEqual(['ordinary'])
  expect(page.mock.calls.map(([request]) => request.kind)).toEqual(['target'])
})

it('cancels a pending target lookup when restoring the active origin without a search view', async () => {
  vi.spyOn(sessionApi, 'load').mockResolvedValue(reply('b', ['ordinary']).session)
  await chatActions.loadSession('b')
  let finish!: (result: HistoryPageReply) => void
  const page = vi.spyOn(sessionApi, 'page').mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  const cancel = vi.spyOn(sessionApi, 'cancelLoad')
  const opened = chatActions.openSearchHit(locator('b', 'hit'), false)
  const [request] = page.mock.calls[0]
  expect(request.kind).toBe('target')
  expect(entry().search).toBeUndefined()

  chatActions.restoreOriginVisit({ session: 'b', pinned: true }, 'back')
  finish(reply('b', ['hit'], true, true))
  expect(await opened).toBe(false)
  expect(cancel).toHaveBeenCalledExactlyOnceWith('b', request.openGeneration)
  expect(entry().search).toBeUndefined()
  expect(entry().session.messages.map((message) => message.id)).toEqual(['ordinary'])
  expect(page).toHaveBeenCalledTimes(1)
})

it('returns a pinned origin to latest even when its reading anchor and generation are available', async () => {
  const page = vi
    .spyOn(sessionApi, 'page')
    .mockResolvedValueOnce(reply('b', ['hit'], true, true))
    .mockResolvedValueOnce(reply('b', ['latest']))
  await chatActions.openSearchHit(locator('b', 'hit'), false)

  chatActions.restoreOriginVisit(
    { session: 'b', pinned: true, generation: 'g', anchor: originAnchor },
    'back'
  )
  expect(page.mock.calls.map(([request]) => request.kind)).toEqual(['target', 'latest'])
  await Promise.resolve()
  expect(entry().search).toBeUndefined()
  expect(entry().session.messages.map((message) => message.id)).toEqual(['latest'])
})
