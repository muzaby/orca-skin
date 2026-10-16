import { describe, expect, it } from 'vitest'
import { describeTool, questionAnswers, readSuccessfulTodos } from '../toolPresentation'
import type { ToolCall } from '../../../reducer/chatReducer'

const call = (name: string, input: unknown = {}, metadata?: unknown): ToolCall => ({
  toolUseId: 't',
  name,
  input,
  providerTool: { name, input },
  ...(metadata ? { result: { output: 'done', isError: false, structuredOutput: metadata } } : {})
})
describe('OpenCode 1.x tool presentation decoder', () => {
  it('only accepts successful root todo results, preferring metadata including an empty clear', () => {
    const input = { todos: [{ content: 'input', status: 'unknown' }] }
    const successful = call('todowrite', input, {
      todos: [{ content: 'result', status: 'pending' }]
    })
    expect(readSuccessfulTodos(successful)).toEqual([{ text: 'result', status: 'pending' }])
    expect(readSuccessfulTodos(call('TodoWrite', input, {}))).toEqual([
      { text: 'input', status: 'unknown' }
    ])
    expect(readSuccessfulTodos(call('todowrite', input, { todos: [] }))).toEqual([])
    expect(readSuccessfulTodos(call('todowrite', input))).toBeUndefined()
    expect(readSuccessfulTodos({ ...successful, parentToolRunId: 'parent' })).toBeUndefined()
    expect(
      readSuccessfulTodos({
        ...successful,
        result: { ...successful.result!, parentToolRunId: 'parent' }
      })
    ).toBeUndefined()
    expect(
      readSuccessfulTodos({ ...successful, result: { ...successful.result!, isError: true } })
    ).toBeUndefined()
    expect(
      readSuccessfulTodos({
        ...successful,
        result: { ...successful.result!, nonExecution: { source: 'sdk', kind: 'permission-rule' } }
      })
    ).toBeUndefined()
  })
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
  it('keeps native paths and raw data while deriving compact shell, search, skill and agent summaries', () => {
    const input = { filePath: 'C:\\workspace\\a.ts', offset: 5, limit: 10 }
    const original = structuredClone(input)
    expect(describeTool(call('read', input))).toMatchObject({
      path: input.filePath,
      arguments: 'offset=5 limit=10',
      original: { name: 'read', input }
    })
    expect(input).toEqual(original)
    expect(describeTool(call('bash', { command: 'Get-Date', description: 'Clock' })).subtitle).toBe(
      'Get-Date'
    )
    expect(describeTool(call('grep', { pattern: 'audit', include: '*.md' })).arguments).toBe(
      'pattern=audit include=*.md'
    )
    expect(describeTool(call('skill', { name: 'audit' })).subtitle).toBe('audit')
    expect(
      describeTool(call('task', { subagent_type: 'explore', description: 'Inspect' }))
    ).toMatchObject({ agent: 'explore', subtitle: 'Inspect' })
  })
  it('reads native positional question answers without mutating the source or displaying rejected results', () => {
    const input = {
      questions: [
        { question: 'First?', options: [] },
        { question: 'Second?', options: [] }
      ]
    }
    const source = call('question', input, { answers: [['A', 'B'], ['C']] })
    const original = structuredClone(source)
    expect(questionAnswers(source).items.map((item) => item.answer)).toEqual(['A, B', 'C'])
    expect(source).toEqual(original)
    expect(
      questionAnswers({ ...source, result: { ...source.result!, isError: true } }).items.map(
        (item) => item.answer
      )
    ).toEqual(['', ''])
    expect(
      questionAnswers(call('question', input, { answers: [null, ['C', 9]] })).items.map(
        (item) => item.answer
      )
    ).toEqual(['', 'C'])
    expect(
      questionAnswers({ ...source, input: { ...input, answers: { 'First?': 'Override' } } })
        .items[0].answer
    ).toBe('Override')
  })
})
