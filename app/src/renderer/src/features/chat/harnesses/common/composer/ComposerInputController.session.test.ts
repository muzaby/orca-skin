import { createElement } from 'react'
import { expect, it, vi } from 'vitest'
import { installFakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { fakeComputeClient } from '../../../../../shared/compute/fakeClient.testfixture'
import { setComputeClient } from '../../../../../shared/compute/client'
import { composerModule } from '../../claude/composer/Module'
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

it('sends the shared draft and both completed previews to the session active at submit', async () => {
  vi.useFakeTimers()
  const dom = installFakeDom({ innerWidth: 800, innerHeight: 600 })
  const compute = fakeComputeClient()
  setComputeClient(compute.client)
  const noop = (): void => {}
  Object.assign(window, {
    oo: {
      files: {
        pathForFile: (file: File) => '/' + file.name,
        readAttachment: async () => ({ mimeType: 'image/png', data: 'AAAA' })
      },
      provider: { state: async () => ({ providers: [] }), onState: () => noop },
      skills: { list: async () => [] },
      session: {
        onManagedMcpChanged: () => noop,
        nativeResources: async () => ({ items: [], revision: 1 })
      }
    }
  })
  const sendA = vi.fn(() => true)
  const sendB = vi.fn(() => true)
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
    dom.unmount()
    setComputeClient(null)
    vi.unstubAllGlobals()
    vi.useRealTimers()
  }
})
