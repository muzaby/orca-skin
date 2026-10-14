import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../../shared/ui/renderHarness.testfixture'
import { OpenCodeToolCard } from './ToolCard'
import { OpenCodeToolGroup } from './ToolGroup'
import { groupTools } from './toolGrouping'
import { transcriptPresentation } from '../../../lib/agentPresentation'
import type { ToolCall } from '../../../reducer/chatReducer'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
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
  it('shows files initially and honors a user collapse after the result arrives', () => {
    const call: ToolCall = {
      toolUseId: 'e',
      name: 'Edit',
      input: { file_path: 'a.ts', old_string: 'before', new_string: 'after' }
    }
    dom.render(createElement(OpenCodeToolCard, { call }))
    expect(dom.body.querySelector('[data-component="opencode-file-diff"]')).not.toBeNull()
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
})
