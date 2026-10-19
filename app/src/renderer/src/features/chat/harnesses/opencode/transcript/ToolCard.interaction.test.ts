import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../../shared/ui/renderHarness.testfixture'
import { OpenCodeToolCard } from './ToolCard'
import { OpenCodeAskExchange } from './AskExchange'
import { chatActions } from '../../../store/chatStore'
import { OpenCodeToolGroup } from './ToolGroup'
import { groupTools } from './toolGrouping'
import { transcriptPresentation } from '../../../lib/agentPresentation'
import type { ToolCall } from '../../../reducer/chatReducer'
import { timelineViewState, TimelineViewState } from './viewState'

const context = vi.hoisted(() => ({ state: null as TimelineViewState | null }))

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useContext: () => context.state
}))
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('../../../hooks/useDiffSyntax', () => ({ useDiffSyntax: () => new Map() }))
let dom: FakeDom
const copy = vi.fn(async () => {})
const nodes = (root: FakeNode): FakeNode[] => [root, ...root.children.flatMap(nodes)]
const tool = (name: string, id = name): ToolCall => ({
  toolUseId: id,
  name,
  input: { command: 'echo hello' }
})
beforeEach(() => {
  context.state = null
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  vi.stubGlobal('navigator', { clipboard: { writeText: copy } })
  copy.mockClear()
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
describe('OpenCode tool interaction', () => {
  it('restores disclosure after virtual unmount and isolates it by session', () => {
    const first = timelineViewState('disclosure-first')
    const second = timelineViewState('disclosure-second')
    first.disclosures.clear()
    second.disclosures.clear()
    context.state = first
    const render = (): void => dom.render(createElement(OpenCodeToolCard, { call: tool('Bash') }))
    render()
    dom.click(dom.body.querySelector('[data-slot="collapsible-trigger"]')!)
    expect(first.disclosures.get('tool:Bash')).toBe(true)
    dom.render(null)
    render()
    expect(
      dom.body.querySelector('[data-slot="collapsible-trigger"]')!.getAttribute('aria-expanded')
    ).toBe('true')
    dom.render(null)
    context.state = second
    render()
    expect(
      dom.body.querySelector('[data-slot="collapsible-trigger"]')!.getAttribute('aria-expanded')
    ).toBe('false')
    dom.render(null)
    context.state = first
    render()
    expect(
      dom.body.querySelector('[data-slot="collapsible-trigger"]')!.getAttribute('aria-expanded')
    ).toBe('true')
  })
  it('opens a running shell, preserves expansion on completion, and copies current output', async () => {
    const pending = tool('Bash')
    const render = (call: ToolCall): void => dom.render(createElement(OpenCodeToolCard, { call }))
    render(pending)
    let trigger = dom.body.querySelector('[data-slot="collapsible-trigger"]')!
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    dom.click(trigger)
    expect(dom.body.textContent).toContain('$ echo hello')
    render({ ...pending, result: { output: 'hello', isError: false } })
    trigger = dom.body.querySelector('[data-slot="collapsible-trigger"]')!
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(dom.body.querySelector('[data-outcome="completed"]')).not.toBeNull()
    dom.click(dom.body.querySelector('[aria-label="common.copy"]')!)
    await Promise.resolve()
    expect(copy).toHaveBeenCalledWith('$ echo hello\n\nhello')
    dom.click(trigger)
    expect(nodes(dom.body).filter((node) => node.tag === 'pre')).toHaveLength(0)
  })
  it('groups contiguous searches without moving tools and does not call a failed group complete', () => {
    const calls = [
      tool('Read', 'r'),
      { ...tool('Grep', 'g'), result: { output: 'denied', isError: true } },
      tool('Bash'),
      tool('Glob'),
      tool('List')
    ]
    expect(groupTools(calls).map((group) => group.map((call) => call.toolUseId))).toEqual([
      ['r', 'g'],
      ['Bash'],
      ['Glob', 'List']
    ])
    calls[0].result = { output: 'file', isError: false }
    dom.render(
      createElement(OpenCodeToolGroup, {
        calls,
        transcriptPolicy: transcriptPresentation('code', 'opencode')
      })
    )
    const groups = dom.body.querySelectorAll('[data-component="context-tool-group"]')
    expect(groups).toHaveLength(2)
    expect(groups[0].textContent).toContain('chat.opencode.explorationIncomplete')
    expect(groups[0].textContent).not.toContain('chat.opencode.explorationDone')
    dom.click(nodes(groups[0]).find((node) => node.tag === 'button')!)
    expect(dom.body.querySelector('[data-outcome="failed"]')).not.toBeNull()
  })
  it('starts file tools collapsed, opens the diff and retains a user collapse after completion', () => {
    const call: ToolCall = {
      toolUseId: 'e',
      name: 'Edit',
      input: { file_path: 'a.ts', old_string: 'before', new_string: 'after' }
    }
    dom.render(createElement(OpenCodeToolCard, { call }))
    expect(dom.body.querySelector('[data-component="opencode-file-diff"]')).toBeNull()
    dom.click(dom.body.querySelector('[data-slot="collapsible-trigger"]')!)
    expect(dom.body.querySelector('[data-component="opencode-file-diff"]')!.textContent).toContain(
      'before'
    )
    expect(dom.body.querySelector('[data-component="opencode-file-diff"]')!.textContent).toContain(
      'after'
    )
    dom.click(dom.body.querySelector('[data-slot="collapsible-trigger"]')!)
    dom.render(
      createElement(OpenCodeToolCard, {
        call: { ...call, result: { output: 'done', isError: false } }
      })
    )
    expect(
      dom.body.querySelector('[data-slot="collapsible-trigger"]')!.getAttribute('aria-expanded')
    ).toBe('false')
  })
  it('shows a successful web fetch as a direct safe link without a nested button', () => {
    dom.render(
      createElement(OpenCodeToolCard, {
        call: {
          toolUseId: 'web',
          name: 'WebFetch',
          input: { url: 'https://example.com' },
          result: { output: 'page', isError: false }
        }
      })
    )
    const link = nodes(dom.body).find((node) => node.tag === 'a')!
    expect(link.getAttribute('href')).toBe('https://example.com')
    expect(dom.body.querySelector('[data-slot="collapsible-trigger"]')).toBeNull()
    expect(dom.body.textContent).not.toContain('page')
  })
  it('opens the existing subagent detail from the agent pill', () => {
    const open = vi.spyOn(chatActions, 'openSubagentTask').mockImplementation(() => {})
    dom.render(
      createElement(OpenCodeToolCard, {
        call: {
          toolUseId: 'task',
          name: 'Task',
          input: { subagent_type: 'explore', description: 'Inspect files' },
          result: { output: 'done', isError: false }
        }
      })
    )
    const trigger = dom.body.querySelector('[data-slot="collapsible-trigger"]')!
    expect(trigger.textContent).toContain('Explore')
    expect(trigger.textContent).toContain('Inspect files')
    dom.click(trigger)
    expect(open).toHaveBeenCalledWith('task', trigger)
    open.mockRestore()
  })
  it('collapses resolved question answers and restores the disclosure after virtual unmount', () => {
    context.state = new TimelineViewState()
    const call: ToolCall = {
      toolUseId: 'q',
      name: 'AskUserQuestion',
      input: { questions: [{ question: 'Which?', header: 'Choice', options: [] }] },
      providerTool: {
        name: 'question',
        input: { questions: [{ question: 'Which?', options: [] }] }
      },
      result: {
        output: 'User has answered your questions',
        structuredOutput: { answers: [['First']] },
        isError: false
      }
    }
    const render = (): void => dom.render(createElement(OpenCodeAskExchange, { call }))
    render()
    expect(dom.body.textContent).toContain('First')
    dom.click(dom.body.querySelector('[aria-expanded="true"]')!)
    expect(dom.body.textContent).not.toContain('Which?')
    expect(dom.body.textContent).not.toContain('First')
    dom.render(null)
    render()
    expect(dom.body.textContent).not.toContain('First')
    dom.click(dom.body.querySelector('[aria-expanded="false"]')!)
    expect(dom.body.textContent).toContain('Which?')
    expect(dom.body.textContent).toContain('First')
  })
  it('keeps failed file output visible when opened and omits duplicate success receipts', () => {
    const input = { file_path: 'a.ts', old_string: 'old', new_string: 'new' }
    const render = (isError: boolean): void =>
      dom.render(
        createElement(OpenCodeToolCard, {
          call: {
            toolUseId: 'edit',
            name: 'Edit',
            input,
            result: { output: isError ? 'failed to save' : 'saved successfully', isError }
          }
        })
      )
    render(true)
    dom.click(dom.body.querySelector('[data-slot="collapsible-trigger"]')!)
    expect(dom.body.textContent).toContain('failed to save')
    render(false)
    expect(dom.body.textContent).not.toContain('saved successfully')
    expect(dom.body.textContent).toContain('new')
  })
})
