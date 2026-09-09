import { describe, expect, it } from 'vitest'
import {
  hasWorkToolRequest,
  workToolPayload,
  workToolPresentation,
  workSearchResults
} from './workToolPresentation'
import type { ToolCall } from '../reducer/chatReducer'

function call(name: string, input: unknown = {}, output?: unknown): ToolCall {
  return {
    toolUseId: 'call-1',
    name,
    input,
    ...(output === undefined ? {} : { result: { output, isError: false } })
  }
}

describe('Work tool presentation', () => {
  it('uses authoritative task-list observations when the wire receipt reports no error', () => {
    const failed = call('TaskUpdate', { taskId: '404', status: 'completed' }, 'wire receipt')
    failed.result!.structuredOutput = { success: false, taskId: '404', error: 'Task not found' }
    expect(workToolPresentation(failed).status).toBe('failed')
    const successful = call('TaskUpdate', { taskId: '7', status: 'completed' }, 'wire receipt')
    successful.result!.structuredOutput = { success: true, taskId: '7' }
    expect(workToolPresentation(successful).status).toBe('completed')
    const missing = call('TaskUpdate', { taskId: '7' }, 'wire receipt')
    expect(workToolPresentation(missing).status).toBe('failed')
    expect(workToolPresentation(call('TaskOutput', { task_id: '7' }, 'wire receipt')).status).toBe(
      'completed'
    )
  })
  it('uses command descriptions, readable file names, search queries and task subjects', () => {
    expect(
      workToolPresentation(call('Bash', { command: 'npm test', description: '검증 실행' }))
    ).toMatchObject({ icon: 'terminal2', description: '검증 실행', status: 'running' })
    expect(
      workToolPresentation(call('Read', { file_path: 'C:\\workspace\\notes.md' }, 'read'))
    ).toMatchObject({
      icon: 'doc',
      labelKey: 'chat.workTool.read',
      target: 'notes.md',
      status: 'completed'
    })
    expect(workToolPresentation(call('WebSearch', { query: 'image sensor QA' }))).toMatchObject({
      icon: 'globe',
      target: 'image sensor QA'
    })
    expect(workToolPresentation(call('TaskCreate', { subject: 'Review findings' }))).toMatchObject({
      icon: 'checklist',
      target: 'Review findings'
    })
  })

  it('keeps unfamiliar tool names with a neutral dot and does not guess from name fragments', () => {
    expect(workToolPresentation(call('mcp__custom__research_data'))).toMatchObject({
      icon: null,
      description: 'mcp__custom__research_data'
    })
  })

  it('distinguishes failed, aborted and pending calls without discarding partial results', () => {
    const failed = call('Bash', {}, 'partial output\ncommand failed')
    failed.result!.isError = true
    expect(workToolPresentation(failed).status).toBe('failed')
    expect(workToolPayload(failed.result!.output).text).toBe('partial output\ncommand failed')
    const aborted = call('Bash', {}, { reason: 'aborted', message: 'Stopped' })
    aborted.result!.isError = true
    expect(workToolPresentation(aborted).status).toBe('aborted')
    expect(
      workToolPresentation(
        call(
          'Artifact',
          { action: 'watch' },
          {
            watch: { watching: false, outcome: 'failed', reason: 'mint_failed' }
          }
        )
      ).status
    ).toBe('failed')
    expect(
      workToolPresentation(
        call(
          'ReadMcpResourceDirTool',
          {},
          {
            error: 'Directory listing is not enabled in this build.'
          }
        )
      ).status
    ).toBe('failed')
    expect(
      workToolPresentation(call('Custom', {}, { error: 'an ordinary data field' })).status
    ).toBe('completed')
  })
})

describe('Work request and response payload', () => {
  it('omits only absent or empty-object requests and preserves explicit payload values', () => {
    expect(hasWorkToolRequest(undefined)).toBe(false)
    expect(hasWorkToolRequest({})).toBe(false)
    for (const input of [null, [], '', '{}', false, 0, { query: '' }])
      expect(hasWorkToolRequest(input)).toBe(true)
  })
  it('preserves plain and JSON strings exactly and pretty prints actual objects', () => {
    expect(workToolPayload('  first\n\nlast  ')).toEqual({
      text: '  first\n\nlast  ',
      language: 'text'
    })
    expect(workToolPayload('{"query":"raw"}\n')).toEqual({
      text: '{"query":"raw"}\n',
      language: 'json'
    })
    expect(workToolPayload({ query: 'raw' })).toEqual({
      text: '{\n  "query": "raw"\n}',
      language: 'json'
    })
    expect(workToolPayload(undefined)).toEqual({ text: '', language: 'text' })
  })
  it('reads MCP text content while preserving unrecognized structured blocks', () => {
    expect(workToolPayload([{ type: 'text', text: 'line one\nline two' }])).toEqual({
      text: 'line one\nline two',
      language: 'text'
    })
    expect(workToolPayload([{ type: 'tool_reference', tool_name: 'Read' }]).text).toContain(
      '"tool_name": "Read"'
    )
  })
})

describe('Work search results from actual output', () => {
  const link = { title: 'A [bracket] in the title', url: 'https://example.com/docs' }
  it('extracts known structured results and validates links without inventing results', () => {
    const search = call(
      'WebSearch',
      { query: 'docs' },
      {
        results: [
          {
            content: [
              link,
              { title: 'Unsafe', url: 'javascript:alert(1)' },
              link,
              { title: 'Credentials', url: 'https://user:password@example.com/private' },
              { title: 'Relative', url: '/docs' }
            ]
          }
        ]
      }
    )
    expect(workSearchResults(search)).toEqual([link])
    expect(workSearchResults(call('WebSearch', { query: 'docs' }))).toEqual([])
    expect(workSearchResults(call('Unrelated', {}, { results: [link] }))).toEqual([])
  })
  it('extracts only a valid Links JSON array and survives brackets inside quoted titles', () => {
    const wire = 'Web search results\n\nLinks: ' + JSON.stringify([link]) + '\n\nAdditional text'
    expect(workSearchResults(call('WebSearch', {}, wire))).toEqual([link])
    expect(workSearchResults(call('WebSearch', {}, [{ type: 'text', text: wire }]))).toEqual([link])
    expect(workSearchResults(call('WebSearch', {}, 'Links: [not JSON]'))).toEqual([])
    expect(workSearchResults(call('WebSearch', {}, 'a mention of https://example.com'))).toEqual([])
  })
})
