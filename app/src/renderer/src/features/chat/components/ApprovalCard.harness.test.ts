import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const { state } = vi.hoisted(() => ({ state: { backend: 'claude' as 'claude' | 'opencode' } }))
vi.mock('../store/chatStore', () => ({
  useChatSession: (selector: (value: typeof state) => unknown) => selector(state),
  chatActions: { approveTool: vi.fn(), approveToolForSession: vi.fn(), denyTool: vi.fn() }
}))
const { ToolApprovalBody } = await import('./ApprovalCard')

describe('tool approval harness identity', () => {
  it.each(['claude', 'opencode'] as const)(
    'identifies the %s session without changing the approval',
    (backend) => {
      state.backend = backend
      const html = renderToStaticMarkup(
        createElement(ToolApprovalBody, {
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
