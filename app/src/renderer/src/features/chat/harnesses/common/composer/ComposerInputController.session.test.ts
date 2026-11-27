import { createElement } from 'react'
import { expect, it, vi } from 'vitest'
import { installFakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { fakeComputeClient } from '../../../../../shared/compute/fakeClient.testfixture'
import { setComputeClient } from '../../../../../shared/compute/client'
import { composerModule } from '../../claude/composer/Module'
import { chatActions, useChatStore } from '../../../store/chatStore'
import type { HistoryPageReply } from '../../../../../../../shared/history-page'
import { sessionApi } from '../../../../../shared/api/ipc'
import { ComposerInputController } from './ComposerInputController'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useDeferredValue: (value: unknown) => value,
  useImperativeHandle: () => {}
}))
const activeSession = vi.hoisted(() => ({
  sessionId: 'a',
  backend: 'claude',
  agentKind: 'code',
  pendingProjectId: null,
  providerKey: null
}))
vi.mock('../../../store/chatStore', async (original) => ({
  ...(await original<typeof import('../../../store/chatStore')>()),
  useChatSession: (select: (session: typeof activeSession) => unknown) => select(activeSession)
}))
vi.mock('../../../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../../../shared/i18n')>()),
  useI18n: () => ({ tr: (key: string) => key, locale: 'en' })
}))

it('a late history page and thumbnail keep the draft for the active send', async () => {
  vi.useFakeTimers()
  const dom = installFakeDom({ innerWidth: 800, innerHeight: 600 })
  const compute = fakeComputeClient()
  setComputeClient(compute.client)
  const noop = (): void => {}
  const sent = vi.fn().mockResolvedValue({})
  const priorStore = useChatStore.getState()
  Object.assign(window, {
    oo: {
      chat: { send: sent },
      settings: { set: async () => undefined },
      files: {
        pathForFile: (file: File) => '/' + file.name,
        readAttachment: async () => ({ mimeType: 'image/png', data: 'AAAA' })
      },
      provider: { state: async () => ({ providers: [] }), onState: () => noop },
      skills: { list: async () => [] },
      session: {
        cancelLoad: noop,
        onManagedMcpChanged: () => noop,
        nativeResources: async () => ({ items: [], revision: 1 })
      }
    }
  })
  const sendA = vi.fn(chatActions.send)
  const sendB = vi.fn(chatActions.send)
  const makePage = (id: string): HistoryPageReply => ({
    sessionId: id,
    openGeneration: 1,
    requestId: 1,
    status: 'ok',
    targetMessage: 'target',
    session: {
      id,
      agentKind: 'code',
      backend: 'claude',
      title: null,
      complete: false,
      messages: [{ id: 'target', role: 'user', createdAt: 1, parts: [{ type: 'text', text: id }] }],
      history: {
        generation: 'g',
        before: { kind: 'earlierTurn', cursor: 'before' },
        after: { kind: 'laterTurn', cursor: 'after' }
      }
    }
  })
  const page = vi.spyOn(sessionApi, 'page')
  const select = async (id: string): Promise<void> => {
    page.mockResolvedValueOnce(makePage(id))
    expect(
      await chatActions.openSearchHit(
        { v: 1, session: id, source: 'local', identity: '1', epoch: '1' },
        false
      )
    ).toBe(true)
  }
  const render = (session: string, onSend: typeof sendA): void => {
    activeSession.sessionId = session
    dom.render(
      createElement(ComposerInputController, {
        presentation: composerModule,
        active: true,
        backendLabel: 'Claude',
        canAbort: false,
        inflight: false,
        steerBlocked: false,
        toolApprovalPending: false,
        cwd: null,
        onSend,
        diffRequirementSnapshot: {
          sessionId: session,
          sessionKey: session,
          ids: [],
          revision: 0,
          anchors: []
        },
        onClearDiffRequirementsIfUnchanged: noop,
        onCancel: noop,
        controlsStart: null,
        controlsEnd: null
      })
    )
  }
  try {
    await select('a')
    render('a', sendA)
    const fields = { value: 'draft', selectionStart: 5, selectionEnd: 5 }
    const change = dom.query('[aria-label="chat.composer.inputAria"]')!.props.onChange as (event: {
      currentTarget: typeof fields
      target: typeof fields
    }) => void
    dom.act(() => change({ currentTarget: fields, target: fields }))
    const files = ['first.png', 'second.png'].map(
      (name) => new File(['image'], name, { type: 'image/png' })
    )
    const drop = dom.query('[data-harness]')!.props.onDrop as (event: {
      preventDefault(): void
      dataTransfer: { files: File[] }
    }) => void
    dom.act(() => drop({ preventDefault: noop, dataTransfer: { files } }))
    await Promise.resolve()
    compute.resolveNext({ thumbnail: 'data:image/jpeg;base64,ONE' })
    await Promise.resolve()
    let deliver!: (page: HistoryPageReply) => void
    page.mockReturnValueOnce(
      new Promise((resolve) => {
        deliver = resolve
      })
    )
    expect(chatActions.readSearchEdge('a', 'before')).toBe(true)
    await select('b')
    deliver(makePage('a'))
    await Promise.resolve()
    expect(useChatStore.getState().activeKey).toBe('b')
    render('b', sendB)
    expect(compute.cancelled).toHaveLength(0)
    expect(dom.query('[aria-label="chat.composer.inputAria"]')!.props.value).toBe('draft')
    expect(dom.queryAll('[src]').map((img) => img.props.src)).toEqual([
      'data:image/jpeg;base64,ONE'
    ])
    expect(dom.query('[title="second.png"]')).toBeTruthy()
    compute.resolveNext({ thumbnail: 'data:image/jpeg;base64,TWO' })
    await Promise.resolve()
    dom.act(noop)
    dom.click(dom.query('[data-behavior="action:send"]')!)
    expect(sent).toHaveBeenCalledTimes(1)
    expect(sent.mock.calls[0][0]).toMatchObject({ sessionId: 'b', text: 'draft' })
    expect(sendA).not.toHaveBeenCalled()
    expect(sendB).toHaveBeenCalledExactlyOnceWith(
      'draft',
      files.map((file) =>
        expect.objectContaining({ kind: 'path', name: file.name, path: '/' + file.name })
      ),
      files.map((file, index) =>
        expect.objectContaining({
          name: file.name,
          previewDataUrl: 'data:image/jpeg;base64,' + ['ONE', 'TWO'][index]
        })
      ),
      []
    )
    expect(dom.query('[aria-label="chat.composer.inputAria"]')!.props.value).toBe('')
    expect(dom.queryAll('[src]')).toHaveLength(0)
  } finally {
    page.mockRestore()
    useChatStore.setState(priorStore, true)
    dom.unmount()
    setComputeClient(null)
    vi.unstubAllGlobals()
    vi.useRealTimers()
  }
})
