import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearDisclosures,
  clearFocusRecord,
  getDisclosure,
  getFocusRecord,
  getSessionDisclosureKeysForTest,
  pruneDisclosures,
  recordFocus,
  resetDisclosureStoreForTest,
  restoreFocusIfEligible,
  setDisclosure
} from './disclosureStore'
import { chatActions, useChatStore } from './chatStore'
import type { LoadedSession } from '../../../../../shared/ipc'

const { loadMock, cancelLoadMock, refreshMock, setSettingsMock } = vi.hoisted(() => ({
  loadMock: vi.fn(),
  cancelLoadMock: vi.fn(),
  refreshMock: vi.fn(),
  setSettingsMock: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../../../shared/api/ipc', () => ({
  bootApi: { getState: vi.fn(), onState: vi.fn(() => () => undefined) },
  chatApi: {
    send: vi.fn(),
    abort: vi.fn(),
    steer: vi.fn(),
    onEvent: vi.fn(() => () => undefined),
    getSnapshot: vi.fn(),
    listActiveTurns: vi.fn().mockResolvedValue([])
  },
  concurrencyApi: {
    list: vi.fn().mockResolvedValue([]),
    onUpdate: vi.fn(() => () => undefined)
  },
  hostApi: { onLifecycle: vi.fn(() => () => undefined) },
  permissionApi: { respond: vi.fn(), onRequest: vi.fn(() => () => undefined) },
  sessionApi: {
    load: loadMock,
    cancelLoad: cancelLoadMock,
    refresh: refreshMock,
    onTitle: vi.fn(() => () => undefined),
    addDirectory: vi.fn(),
    listBackground: vi.fn().mockResolvedValue([])
  },
  settingsApi: {
    get: vi.fn().mockResolvedValue({}),
    set: setSettingsMock
  }
}))

vi.mock('../../../shared/errors', () => ({
  reportError: vi.fn()
}))

function makeLoadedSession(id: string, extra?: Partial<LoadedSession>): LoadedSession {
  return {
    id,
    backend: 'claude',
    agentKind: 'code',
    title: `Session ${id}`,
    messages: [
      {
        role: 'user',
        createdAt: 1,
        id: `u:${id}-1`,
        parts: [{ type: 'text', text: 'hello' }]
      },
      {
        role: 'assistant',
        createdAt: 2,
        id: `a:${id}-1`,
        parts: [
          {
            type: 'tool_call',
            toolRunId: `tool-${id}`,
            toolName: 'Read',
            args: { file_path: '/a.ts' }
          }
        ]
      }
    ],
    ...extra
  }
}

describe('disclosureStore (EP-15 d1~d12)', () => {
  beforeEach(() => {
    resetDisclosureStoreForTest()
    loadMock.mockReset()
    cancelLoadMock.mockReset()
    refreshMock.mockReset()
    refreshMock.mockResolvedValue({ status: 'unchanged' })
    setSettingsMock.mockClear()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      void cb
      return 1
    })
  })

  it('d1: clears disclosures when openSession cancels another pending load', async () => {
    let resolveFirst!: (val: LoadedSession | null) => void
    loadMock.mockImplementationOnce(
      () =>
        new Promise<LoadedSession | null>((resolve) => {
          resolveFirst = resolve
        })
    )
    loadMock.mockResolvedValueOnce(makeLoadedSession('s-b'))

    setDisclosure('s-a', 'tool:1', true)
    const p1 = chatActions.loadSession('s-a')
    await chatActions.loadSession('s-b')
    expect(cancelLoadMock).toHaveBeenCalledWith('s-a')
    expect(getSessionDisclosureKeysForTest('s-a')).toEqual([])
    expect(useChatStore.getState().sessions['s-a']).toBeUndefined()
    resolveFirst(makeLoadedSession('s-a'))
    await p1
    expect(useChatStore.getState().sessions['s-a']).toBeUndefined()

    expect(getSessionDisclosureKeysForTest('s-a')).toEqual([])
    expect(getDisclosure('s-a', 'tool:1', false)).toBe(false)
  })

  it('d2: clears disclosures when sessionApi.load returns null', async () => {
    setDisclosure('s-null', 'tool:1', true)
    loadMock.mockResolvedValueOnce(null)

    await chatActions.loadSession('s-null')

    expect(getSessionDisclosureKeysForTest('s-null')).toEqual([])
  })

  it('d3: clears disclosures when sessionApi.load throws without cached history', async () => {
    setDisclosure('s-err', 'tool:1', true)
    loadMock.mockRejectedValueOnce(new Error('load failed'))

    await chatActions.loadSession('s-err')

    expect(getSessionDisclosureKeysForTest('s-err')).toEqual([])
  })

  it('d4: clears disclosures on invalidateSessionCache', () => {
    setDisclosure('s-inv', 'tool:1', true)
    chatActions.invalidateSessionCache('s-inv')

    expect(getSessionDisclosureKeysForTest('s-inv')).toEqual([])
  })

  it('d5: clears disclosures on handleSessionDeleted', () => {
    setDisclosure('s-del', 'tool:1', true)
    recordFocus('s-del', 'tool:1', 'toggle')
    chatActions.handleSessionDeleted('s-del')

    expect(getSessionDisclosureKeysForTest('s-del')).toEqual([])
    expect(getFocusRecord()).toBeNull()
  })

  it('d6: preserves disclosures across session switches', async () => {
    loadMock.mockResolvedValueOnce(makeLoadedSession('s-1'))
    loadMock.mockResolvedValueOnce(makeLoadedSession('s-2'))

    await chatActions.loadSession('s-1')
    setDisclosure('s-1', 'tool:tool-s-1', true)
    await chatActions.loadSession('s-2')
    setDisclosure('s-2', 'tool:tool-s-2', true)

    expect(getDisclosure('s-1', 'tool:tool-s-1', false)).toBe(true)
    expect(getDisclosure('s-2', 'tool:tool-s-2', false)).toBe(true)
  })

  it('d7: preserves existing keys on reset{complete: true}', () => {
    setDisclosure('s-1', 'tool:keep', true)
    pruneDisclosures('s-1', new Set(['tool:keep', 'tool:other']), true)

    expect(getDisclosure('s-1', 'tool:keep', false)).toBe(true)
  })

  it('d8·d9: restores focus only when activeElement dropped to body, never steals focus moved elsewhere', () => {
    const body = {} as HTMLElement
    const composer = {} as HTMLElement
    const focusSpy = vi.fn()
    const control = {
      getAttribute: (name: string) => (name === 'data-focus-id' ? 'toggle' : null),
      focus: focusSpy
    } as unknown as HTMLElement
    const container = {
      getAttribute: () => null,
      querySelector: (sel: string) => (sel === '[data-focus-id="toggle"]' ? control : null)
    } as unknown as HTMLElement

    let currentActive: HTMLElement | null = body
    vi.stubGlobal('document', {
      body,
      get activeElement() {
        return currentActive
      },
      addEventListener: vi.fn()
    })

    // d8: unmounted -> activeElement fell to body -> remount restores focus
    setDisclosure('s-1', 'tool:t1', true)
    recordFocus('s-1', 'tool:t1', 'toggle')
    currentActive = body
    expect(restoreFocusIfEligible('s-1', 'tool:t1', container)).toBe(true)
    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(getDisclosure('s-1', 'tool:t1', false)).toBe(true)

    // d9: focus moved to composer while unmounted -> remount does NOT steal focus
    focusSpy.mockClear()
    recordFocus('s-1', 'tool:t1', 'toggle')
    currentActive = composer
    expect(restoreFocusIfEligible('s-1', 'tool:t1', container)).toBe(false)
    expect(focusSpy).not.toHaveBeenCalled()
    expect(getFocusRecord()).toBeNull()

    clearFocusRecord()
    clearDisclosures('s-1')
  })

  it('d9 forgets focus if either the control or its owning block changes', async () => {
    vi.resetModules()
    const isolated = await import('./disclosureStore')
    const listen = vi.fn()
    class Control {
      constructor(
        readonly block: string,
        readonly control: string
      ) {}
      closest(): Control {
        return this
      }
      getAttribute(name: string): string {
        return name === 'data-block-key' ? this.block : this.control
      }
    }
    vi.stubGlobal('Element', Control)
    vi.stubGlobal('document', { addEventListener: listen })
    try {
      for (const [block, control, retained] of [
        ['original', 'toggle', true],
        ['other', 'toggle', false],
        ['original', 'copy', false]
      ] as const) {
        isolated.recordFocus('s-1', 'original', 'toggle')
        const listener = listen.mock.calls.find(([type]) => type === 'focusin')![1]
        listener({ target: new Control(block, control) })
        expect(isolated.getFocusRecord()).toEqual(
          retained ? { sessionKey: 's-1', blockKey: 'original', focusId: 'toggle' } : null
        )
      }
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('d8/d9 restores only the recorded session, block and control from body without scrolling', () => {
    const body = {} as HTMLElement
    const focus = vi.fn()
    const control = { getAttribute: () => 'toggle', focus } as unknown as HTMLElement
    const page = { activeElement: null as HTMLElement | null, body, addEventListener: vi.fn() }
    vi.stubGlobal('document', page)
    recordFocus('s-1', 'block', 'toggle')
    expect(restoreFocusIfEligible('s-1', 'block', control)).toBe(false)
    expect(getFocusRecord()).toMatchObject({ sessionKey: 's-1' })
    page.activeElement = body
    expect(restoreFocusIfEligible('s-2', 'block', control)).toBe(false)
    expect(restoreFocusIfEligible('s-1', 'other', control)).toBe(false)
    expect(focus).not.toHaveBeenCalled()
    expect(restoreFocusIfEligible('s-1', 'block', control)).toBe(true)
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true })
  })

  it('d7/d10/d11 prunes focus independently of the session map and preserves sibling session keys', () => {
    setDisclosure('other', 'different', true)
    recordFocus('s-1', 'offscreen', 'toggle')
    pruneDisclosures('s-1', new Set(), false)
    pruneDisclosures('other', new Set(['different']), true)
    expect(getFocusRecord()).toEqual({
      sessionKey: 's-1',
      blockKey: 'offscreen',
      focusId: 'toggle'
    })
    pruneDisclosures('s-1', new Set(['offscreen']), true)
    expect(getFocusRecord()?.focusId).toBe('toggle')
    pruneDisclosures('s-1', new Set(['toggle']), true)
    expect(getFocusRecord()).toBeNull()
    expect(getDisclosure('other', 'different')).toBe(true)
    setDisclosure('s-1', 'key', false)
    recordFocus('s-1', 'offscreen', 'toggle')
    pruneDisclosures('s-1', new Set(['key']), true)
    expect(getDisclosure('s-1', 'key', true)).toBe(false)
    expect(getFocusRecord()).toBeNull()
    clearDisclosures('s-1')
    expect(getDisclosure('other', 'different')).toBe(true)
  })

  it('d10·d11: pruneDisclosures keeps absent keys when complete=false and drops them when complete=true', () => {
    setDisclosure('s-1', 'tool:present', true)
    setDisclosure('s-1', 'tool:offscreen', true)

    // d10: partial reset (complete: false) must NOT prune offscreen keys
    pruneDisclosures('s-1', new Set(['tool:present']), false)
    expect(getDisclosure('s-1', 'tool:present', false)).toBe(true)
    expect(getDisclosure('s-1', 'tool:offscreen', false)).toBe(true)

    // d11: complete reset (complete: true) prunes keys absent from snapshot
    pruneDisclosures('s-1', new Set(['tool:present']), true)
    expect(getDisclosure('s-1', 'tool:present', false)).toBe(true)
    expect(getDisclosure('s-1', 'tool:offscreen', false)).toBe(false)
    expect(getSessionDisclosureKeysForTest('s-1')).toEqual(['tool:present'])
  })

  it('d12: forwards complete=false from sessionApi.load through chatStore to LOAD_SESSION and skips prune', async () => {
    setDisclosure('s-partial', 'tool:offscreen', true)
    loadMock.mockResolvedValueOnce(makeLoadedSession('s-partial', { complete: false }))

    await chatActions.loadSession('s-partial')

    const entry = useChatStore.getState().sessions['s-partial']
    expect(entry.session.historyComplete).toBe(false)
    const lastChange = entry.session.transcriptChanges.log.at(-1)
    expect(lastChange).toEqual({ kind: 'reset', complete: false })

    // Applying prune with the recorded change's complete flag must preserve offscreen disclosures
    pruneDisclosures(
      's-partial',
      new Set(['tool:tool-s-partial']),
      lastChange?.kind === 'reset' ? lastChange.complete : true
    )
    expect(getDisclosure('s-partial', 'tool:offscreen', false)).toBe(true)
  })
})
