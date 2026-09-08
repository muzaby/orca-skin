import { createElement, type ButtonHTMLAttributes } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentModeToggle } from './AgentModeToggle'
import { agentPresentation } from '../lib/agentPresentation'
const harness = vi.hoisted(() => ({
  state: { agentKind: 'coding', agentKindLocked: false, sessionId: null as string | null },
  select: vi.fn(),
  buttons: [] as ButtonHTMLAttributes<HTMLButtonElement>[]
}))
vi.mock('../store/chatStore', () => ({
  useChatSession: (selector: (state: typeof harness.state) => unknown) => selector(harness.state),
  chatActions: { setAgentKind: harness.select }
}))
vi.mock('../../../shared/ui/Button', () => ({
  Button: (props: ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean }) => {
    harness.buttons.push(props)
    return createElement('button', {
      ...props,
      'aria-pressed': props.pressed,
      pressed: undefined
    } as ButtonHTMLAttributes<HTMLButtonElement>)
  }
}))
describe('actual draft mode toggle', () => {
  beforeEach(() => {
    harness.buttons = []
    harness.select.mockClear()
    harness.state = { agentKind: 'coding', agentKindLocked: false, sessionId: null }
  })
  it('places Todo Work on the left and Terminal Coding on the right with accessible selected state', () => {
    const html = renderToStaticMarkup(createElement(AgentModeToggle))
    expect(agentPresentation.work.icon).toBe('todo')
    expect(agentPresentation.coding.icon).toBe('terminal')
    expect(harness.buttons.map((button) => button['aria-label'])).toEqual(['작업', '코딩'])
    expect(html).toContain('aria-pressed="true"')
    harness.buttons[0].onClick?.({} as never)
    expect(harness.select).toHaveBeenCalledWith('work')
  })
  it('locks both mode controls after first send or loading a session', () => {
    harness.state.agentKindLocked = true
    renderToStaticMarkup(createElement(AgentModeToggle))
    expect(harness.buttons.every((button) => button.disabled)).toBe(true)
    harness.buttons = []
    harness.state.agentKindLocked = false
    harness.state.sessionId = 'saved'
    renderToStaticMarkup(createElement(AgentModeToggle))
    expect(harness.buttons.every((button) => button.disabled)).toBe(true)
  })
})
