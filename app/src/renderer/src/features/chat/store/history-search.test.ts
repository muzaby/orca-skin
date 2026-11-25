import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  HistoryPageReply,
  HistoryLocator,
  HistoryEdge
} from '../../../../../shared/history-page'
import { chatActions, useChatStore, type SessionEntry } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { sessionApi } from '../../../shared/api/ipc'

const locator = (session: string, key = 'm:2'): HistoryLocator => ({
  v: 1,
  session,
  source: 'local',
  identity: key,
  projectedKey: key,
  epoch: 'e'
})
const edge = (kind: 'earlierTurn' | 'laterTurn'): HistoryEdge => ({ kind, cursor: kind })
function reply(session: string, ids: string[], before = false, after = false): HistoryPageReply {
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
  it('reads a bounded latest page for a cold search and preserves the view if returning fails', async () => {
    const page = vi.spyOn(sessionApi, 'page').mockResolvedValueOnce(reply('b', ['m:2'], true, true))
    await chatActions.openSearchHit(locator('b'), false)
    page.mockRejectedValueOnce(Error('unavailable'))
    chatActions.leaveSearch('b', true)
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
