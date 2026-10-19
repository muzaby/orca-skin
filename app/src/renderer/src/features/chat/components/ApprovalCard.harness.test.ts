import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const { state, actions } = vi.hoisted(() => ({
  state: { backend: 'claude' as 'claude' | 'opencode' },
  actions: { approveTool: vi.fn(), approveToolForSession: vi.fn(), denyTool: vi.fn() }
}))
vi.mock('../store/chatStore', () => ({
  useChatSession: (selector: (value: typeof state) => unknown) => selector(state),
  chatActions: actions
}))
vi.mock('../../../shared/i18n', async (original) => {
  const module = await original<typeof import('../../../shared/i18n')>()
  return { ...module, useI18n: () => ({ tr: module.i18n.t, locale: 'ko' }) }
})
const { ToolApprovalBody: ClaudeApproval } =
  await import('../harnesses/claude/composer/ToolApproval')
const { ToolApprovalBody: OpenCodeApproval } =
  await import('../harnesses/opencode/composer/ToolApproval')

describe('tool approval harness identity', () => {
  it.each(['claude', 'opencode'] as const)(
    'identifies the %s session without changing the approval',
    (backend) => {
      state.backend = backend
      const html = renderToStaticMarkup(
        createElement(backend === 'claude' ? ClaudeApproval : OpenCodeApproval, {
          approvalId: 'approval-1',
          toolName: 'Read',
          input: { file_path: 'sample.md' }
        })
      )
      expect(html).toContain(
        `${backend === 'opencode' ? 'OpenCode' : 'Claude'}가 Read 실행 권한을 요청합니다`
      )
      expect(html).not.toContain(backend === 'opencode' ? 'Claude' : 'OpenCode')
      expect(html).toContain('sample.md')
      expect(html).toContain('세션 동안 허용')
      expect(html).toContain('거부')
    }
  )
})

// Stateless dock callbacks are exercised through the concrete production body.
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../shared/ui/renderHarness.testfixture'
let dom: FakeDom
beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  vi.clearAllMocks()
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
it.each(['allow', 'session', 'deny'] as const)(
  'routes OpenCode %s with the original approval identity',
  (action) => {
    state.backend = 'opencode'
    dom.render(
      createElement(OpenCodeApproval, {
        approvalId: 'request-77',
        toolName: 'Edit',
        input: { file_path: 'sample.md' }
      })
    )
    const all = (node: FakeNode): FakeNode[] => [node, ...node.children.flatMap(all)]
    const label = action === 'allow' ? '허용' : action === 'session' ? '세션 동안 허용' : '거부'
    dom.click(all(dom.body).find((node) => node.tag === 'button' && node.textContent === label)!)
    if (action === 'allow')
      expect(actions.approveTool).toHaveBeenCalledExactlyOnceWith('request-77')
    if (action === 'session')
      expect(actions.approveToolForSession).toHaveBeenCalledExactlyOnceWith('request-77', 'Edit')
    if (action === 'deny') expect(actions.denyTool).toHaveBeenCalledExactlyOnceWith('request-77')
  }
)
