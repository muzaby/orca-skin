import { describe, expect, it } from 'vitest'
import { describeTool } from '../toolPresentation'
import type { ToolCall } from '../../../reducer/chatReducer'

const call = (name: string, input: unknown = {}, metadata?: unknown): ToolCall => ({
  toolUseId: 't',
  name,
  input,
  providerTool: { name, input },
  ...(metadata ? { result: { output: 'done', isError: false, structuredOutput: metadata } } : {})
})
describe('OpenCode 1.x tool presentation decoder', () => {
  it.each([
    ['Read', 'read'],
    ['glob', 'search'],
    ['grep', 'search'],
    ['list', 'list'],
    ['Bash', 'shell'],
    ['PowerShell', 'shell'],
    ['edit', 'edit'],
    ['MultiEdit', 'edit'],
    ['patch', 'edit'],
    ['apply_patch', 'edit'],
    ['write', 'write'],
    ['webfetch', 'web'],
    ['WebSearch', 'web'],
    ['task', 'task'],
    ['Agent', 'task'],
    ['todowrite', 'todo'],
    ['mcp_widget', 'generic']
  ])('classifies %s while preserving native input', (name, kind) => {
    const input = { key: 'value' }
    expect(describeTool(call(name, input))).toMatchObject({
      kind,
      original: { name, input },
      outcome: 'running'
    })
  })
  it('prefers actual file snapshots over predicted input and accepts patch file arrays', () => {
    expect(
      describeTool(
        call(
          'edit',
          { filePath: 'a.ts', oldString: 'predicted', newString: 'next' },
          {
            filediff: { file: 'a.ts', before: 'actual before', after: 'actual after' }
          }
        )
      ).files
    ).toEqual([{ path: 'a.ts', before: 'actual before', after: 'actual after', patch: undefined }])
    expect(
      describeTool(
        call(
          'patch',
          {},
          {
            files: [
              { filePath: 'b.ts', before: 'old', after: 'new' },
              { filePath: 'c.ts', diff: '@@ -1 +1 @@\n-old\n+new' },
              null
            ]
          }
        )
      ).files
    ).toHaveLength(2)
  })
  it('supports normalized history without native metadata, including MultiEdit and Write', () => {
    expect(
      describeTool(call('Edit', { file_path: 'a.ts', old_string: 'old', new_string: 'new' }))
        .files[0]
    ).toMatchObject({ path: 'a.ts', before: 'old', after: 'new' })
    expect(
      describeTool(
        call('MultiEdit', {
          file_path: 'a.ts',
          edits: [
            { old_string: 'a', new_string: 'b' },
            { old_string: 'c', new_string: 'd' }
          ]
        })
      ).files
    ).toHaveLength(2)
    expect(describeTool(call('Write', { file_path: 'a.ts', content: 'new' })).files[0].after).toBe(
      'new'
    )
  })
  it('keeps errors, filters unsafe URLs and strips ANSI from shell display/copy', () => {
    const shell = call('bash', { command: 'echo hi' })
    shell.result = { isError: true, output: '\u001b[31mfailed\u001b[0m' }
    expect(describeTool(shell)).toMatchObject({
      outcome: 'failed',
      output: 'failed',
      command: 'echo hi'
    })
    expect(describeTool(call('webfetch', { url: 'javascript:alert(1)' })).url).toBeUndefined()
    expect(describeTool(call('webfetch', { url: 'https://example.com' })).url).toBe(
      'https://example.com'
    )
    expect(describeTool(call('custom', null)).files).toEqual([])
  })
  it('uses metadata todos when returned, falling back to pending input', () => {
    const input = { todos: [{ content: 'pending', status: 'pending' }] }
    expect(describeTool(call('todowrite', input)).todos).toEqual([
      { text: 'pending', status: 'pending' }
    ])
    expect(
      describeTool(call('todowrite', input, { todos: [{ content: 'done', status: 'completed' }] }))
        .todos
    ).toEqual([{ text: 'done', status: 'completed' }])
  })
})
