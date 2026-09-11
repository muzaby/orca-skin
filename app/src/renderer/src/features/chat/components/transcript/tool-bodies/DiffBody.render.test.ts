import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { DiffLine } from '../../../lib/diffLines'
import type { ToolCall } from '../../../reducer/chatReducer'
import type { GitDiffPatch } from '../../../../../../../shared/ipc'

const highlightedPaths: string[] = []
const storeHarness = vi.hoisted(() => ({ patch: null as GitDiffPatch | null }))

vi.mock('../../../hooks/useDiffSyntax', () => ({
  useDiffSyntax: (lines: readonly DiffLine[], filePath: string) => {
    highlightedPaths.push(filePath)
    return new Map(
      lines.map((line) => [
        line,
        {
          old: [{ content: line.text, color: '#aa0000', offset: 0 }],
          new: [{ content: line.text, color: '#00aa00', offset: 0 }]
        }
      ])
    )
  }
}))

vi.mock('../../../store/chatStore', () => ({
  useChatSession: (selector: (state: { gitSnapshot: { patch: GitDiffPatch | null } }) => unknown) =>
    selector({ gitSnapshot: { patch: storeHarness.patch } })
}))

import { DiffBody, buildPairs } from './DiffBody'

function call(name: ToolCall['name'], input: Record<string, unknown>): ToolCall {
  return { toolUseId: `${name}-1`, name, input }
}

describe('Code file edit tool body', () => {
  storeHarness.patch = null
  it.each([
    ['Write', { file_path: 'src/new.ts', content: 'const answer = 42' }, '', 'const answer = 42'],
    [
      'Edit',
      { file_path: 'src/edit.ts', old_string: 'const oldValue = 1', new_string: 'const value = 2' },
      'const oldValue = 1',
      'const value = 2'
    ]
  ] as const)(
    'keeps the exact %s target and forwards its language path',
    (name, input, oldText, newText) => {
      highlightedPaths.length = 0
      const toolCall = call(name, input)
      expect(buildPairs(toolCall)).toEqual([{ oldValue: oldText, newValue: newText }])
      const html = renderToStaticMarkup(createElement(DiffBody, { call: toolCall }))
      expect(highlightedPaths).toEqual([input.file_path])
      expect(html).toContain(newText)
      expect(html).toContain('color:#00aa00')
    }
  )

  it('renders every MultiEdit pair and hides unverified relative axes', () => {
    highlightedPaths.length = 0
    const toolCall = call('MultiEdit', {
      file_path: 'src/multi.tsx',
      edits: [
        { old_string: 'old one', new_string: 'new one' },
        { old_string: 'old two\ncontext', new_string: 'new two\ncontext' }
      ]
    })
    expect(buildPairs(toolCall)).toHaveLength(2)
    const html = renderToStaticMarkup(createElement(DiffBody, { call: toolCall }))
    expect(highlightedPaths).toEqual(['src/multi.tsx', 'src/multi.tsx'])
    expect(html).toContain('old one')
    expect(html).toContain('new two')
    expect(html).not.toMatch(/<pre[^>]*>\d+<\/pre>/)
  })

  it('renders the actual 46/47 axes from the owning Git patch', () => {
    storeHarness.patch = {
      isRepo: true,
      base: { kind: 'head', oid: 'base' },
      filesTruncated: false,
      contextLimited: false,
      unavailable: false,
      files: [
        {
          path: 'hello_world.ts',
          status: 'modified',
          added: 1,
          removed: 1,
          kind: 'text',
          lines: [
            {
              type: 'removed',
              oldLine: 46,
              newLine: null,
              text: 'async function animate(): Promise<void> {'
            },
            {
              type: 'added',
              oldLine: null,
              newLine: 47,
              text: 'async function animate2(): Promise<void> {'
            }
          ]
        }
      ]
    }
    const html = renderToStaticMarkup(
      createElement(DiffBody, {
        call: call('Edit', {
          file_path: 'C:\\repo\\hello_world.ts',
          old_string: 'async function animate(): Promise<void> {',
          new_string: 'async function animate2(): Promise<void> {'
        })
      })
    )
    expect(html).toContain('>46</pre>')
    expect(html).toContain('>47</pre>')
    storeHarness.patch = null
  })
})
