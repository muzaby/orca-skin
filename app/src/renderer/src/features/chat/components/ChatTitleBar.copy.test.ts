import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { initialChatState, type ChatState } from '../reducer/chatReducer'
import { ChatTitleBar } from './ChatTitleBar'

const fixture = vi.hoisted(() => ({
  state: undefined as unknown as ChatState,
  copy: undefined as (() => void) | undefined
}))
vi.mock('../store/chatStore', () => ({
  chatActions: {},
  getActiveChatSession: () => fixture.state,
  useChatSession: (select: (state: ChatState) => unknown) => select(fixture.state),
  useUnseenSettledTaskCount: () => 0
}))
vi.mock('./CwdButton', () => ({ CwdButton: () => null }))
vi.mock('../../../shared/ui/Popover', () => ({ Popover: () => null }))
vi.mock('../../../shared/ui/Button', () => ({
  Button: ({ leadingIcon, onClick }: { leadingIcon?: string; onClick?: () => void }) => {
    if (leadingIcon === 'copy') fixture.copy = onClick
    return null
  }
}))
afterEach(() => vi.unstubAllGlobals())

it.each(['claude', 'opencode', null] as const)(
  'copies the %s conversation with its short harness label',
  async (backend) => {
    fixture.state = {
      ...initialChatState,
      backend,
      messages: [{ role: 'assistant', createdAt: 1, parts: [{ type: 'text', text: 'answer' }] }]
    }
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('window', { setTimeout: vi.fn() })
    renderToStaticMarkup(createElement(ChatTitleBar))
    fixture.copy!()
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      `## ${backend === 'opencode' ? 'OpenCode' : 'Claude'}\n\nanswer`
    )
  }
)
