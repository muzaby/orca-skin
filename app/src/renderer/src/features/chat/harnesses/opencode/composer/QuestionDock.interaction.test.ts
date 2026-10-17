import { createElement } from 'react'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../../shared/ui/renderHarness.testfixture'
import { OpenCodeQuestionDock } from './QuestionDock'
import type { AskQuestionRequest } from '../../../../../../../shared/ipc'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
let dom: FakeDom
const submit = vi.fn()
const skip = vi.fn()
const ask: AskQuestionRequest = {
  requestId: 'q1',
  questions: [
    {
      header: 'Target',
      question: 'Choose target',
      multiSelect: false,
      options: [
        { label: 'Alpha', description: 'First' },
        { label: 'Beta', description: 'Second' }
      ]
    },
    {
      header: 'Checks',
      question: 'Choose checks',
      multiSelect: true,
      options: [
        { label: 'Lint', description: '' },
        { label: 'Build', description: '' }
      ]
    }
  ]
}
const all = (node: FakeNode): FakeNode[] => [node, ...node.children.flatMap(all)]
const button = (text: string): FakeNode =>
  all(dom.body).find((node) => node.tag === 'button' && node.textContent.includes(text))!
const render = (request = ask): void =>
  dom.render(
    createElement(OpenCodeQuestionDock, {
      key: request.requestId,
      ask: request,
      onSubmit: submit,
      onSkip: skip
    })
  )
const key = (value: string, options: Record<string, unknown> = {}): void => {
  const node = dom.body.querySelector('[data-component="opencode-question"]')!
  dom.act(() =>
    (node.props.onKeyDown as (event: unknown) => void)({
      key: value,
      target: dom.activeElement,
      nativeEvent: { isComposing: false },
      preventDefault: vi.fn(),
      ...options
    })
  )
}
beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  submit.mockClear()
  skip.mockClear()
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('OpenCode question dock', () => {
  it('keeps a single selection until Next and preserves all answers when navigating back or collapsing', () => {
    render()
    expect(button('chat.ask.next').props.disabled).toBe(true)
    dom.click(button('Beta'))
    dom.advance(300)
    expect(dom.body.textContent).toContain('Choose target')
    expect(dom.body.querySelector('[role="radio"][aria-checked="true"]')?.textContent).toContain(
      'Beta'
    )
    dom.click(button('chat.ask.next'))
    dom.click(button('Lint'))
    dom.click(button('Build'))
    dom.click(dom.body.querySelector('[aria-label="chat.ask.prevQuestion"]')!)
    expect(dom.body.querySelector('[role="radio"][aria-checked="true"]')?.textContent).toContain(
      'Beta'
    )
    dom.click(dom.body.querySelector('[aria-label="chat.opencode.toggleQuestion"]')!)
    expect(dom.body.querySelector('[role="radiogroup"]')).toBeNull()
    dom.click(dom.body.querySelector('[aria-label="chat.opencode.toggleQuestion"]')!)
    key('Enter', { ctrlKey: true })
    expect(dom.body.querySelectorAll('[role="checkbox"][aria-checked="true"]')).toHaveLength(2)
    dom.click(button('chat.ask.submit'))
    key('Enter', { ctrlKey: true })
    expect(submit).toHaveBeenCalledExactlyOnceWith({
      'Choose target': 'Beta',
      'Choose checks': ['Lint', 'Build']
    })
  })
  it('uses custom input instead of a single pick, appends it for multi-select, and resets on a new request', () => {
    render()
    dom.click(button('Alpha'))
    const input = (): FakeNode => all(dom.body).find((node) => node.tag === 'input')!
    const type = (value: string): void =>
      dom.act(() => {
        ;(input().props.onFocus as () => void)()
        ;(input().props.onChange as (event: unknown) => void)({ target: { value } })
      })
    type('  custom target  ')
    expect(dom.body.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1)
    dom.click(button('chat.ask.next'))
    dom.click(button('Lint'))
    type('  Test  ')
    dom.click(button('chat.ask.submit'))
    expect(submit).toHaveBeenCalledWith({
      'Choose target': 'custom target',
      'Choose checks': ['Lint', 'Test']
    })
    dom.unmount() // The production Composer keys the card by requestId.
    render({ ...ask, requestId: 'q2' })
    expect(button('chat.ask.next').props.disabled).toBe(true)
    expect(input().props.value).toBe('')
  })
  it('does not submit during composition or key-repeat, supports number/arrow/back shortcuts and Escape', () => {
    render()
    key('2')
    key('Enter', { ctrlKey: true, nativeEvent: { isComposing: true } })
    key('Enter', { ctrlKey: true, repeat: true })
    expect(dom.body.textContent).toContain('Choose target')
    key('End')
    expect(dom.activeElement.getAttribute('data-slot')).toBe('question-option')
    key('Enter', { ctrlKey: true })
    key('ArrowLeft', { altKey: true })
    expect(dom.body.textContent).toContain('Choose target')
    key('Escape')
    key('Escape')
    expect(skip).toHaveBeenCalledTimes(1)
    expect(submit).not.toHaveBeenCalled()
  })
})
