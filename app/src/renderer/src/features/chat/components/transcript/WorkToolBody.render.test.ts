import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WorkToolBody } from './WorkToolBody'
import { WorkToolRow } from './WorkToolTimeline'
import type { ToolCall } from '../../reducer/chatReducer'

const base: ToolCall = {
  toolUseId: 'read-1',
  name: 'Read',
  input: { file_path: 'C:/example.md' }
}

describe('Work tool row and body rendering', () => {
  it.each([undefined, {}])('omits an empty request and keeps the actual response (%j)', (input) => {
    const html = renderToStaticMarkup(
      createElement(WorkToolBody, {
        call: {
          toolUseId: 'list-agents',
          name: 'ListAgents',
          input,
          result: { output: 'Actual agent listing', isError: false }
        }
      })
    )
    expect(html).not.toContain('aria-label="요청"')
    expect(html).toContain('aria-label="응답"')
    expect(html).toContain('Actual agent listing')
  })
  it('shows task-update structured failure in the actual Work row and response body', () => {
    const call: ToolCall = {
      toolUseId: 'task-failed',
      name: 'TaskUpdate',
      input: { taskId: '404', status: 'completed' },
      result: {
        output: 'wire receipt',
        isError: false,
        structuredOutput: { success: false, taskId: '404', error: 'Task not found' }
      }
    }
    const row = renderToStaticMarkup(createElement(WorkToolRow, { call }))
    expect(row).toContain('data-tool-status="failed"')
    const html = renderToStaticMarkup(createElement(WorkToolBody, { call }))
    expect(html).toContain('aria-label="오류"')
    expect(html).toContain('Task not found')
    expect(html.indexOf('Task not found')).toBeLessThan(html.indexOf('<details'))
    expect(html).toContain('wire receipt')
    expect(html).toContain('원문 응답')
  })

  it.each<[string, unknown, unknown, string[]]>([
    [
      'TaskCreate',
      { subject: 'input title' },
      { task: { id: '7', subject: 'normalized title' } },
      ['#7', 'normalized title', 'pending']
    ],
    [
      'TaskGet',
      { taskId: '7' },
      { task: { id: '7', subject: 'stored title', status: 'in_progress' } },
      ['#7', 'stored title', 'in_progress']
    ],
    [
      'TaskUpdate',
      { taskId: '7', status: 'completed' },
      { success: true, taskId: '7' },
      ['#7', 'completed']
    ],
    [
      'TaskList',
      {},
      { tasks: [{ id: '7', subject: 'listed title', status: 'pending' }] },
      ['전체 조회', '1건']
    ]
  ])(
    'preserves %s structured task semantics inside the Work response',
    (name, input, structuredOutput, expected) => {
      const html = renderToStaticMarkup(
        createElement(WorkToolBody, {
          call: {
            toolUseId: 'task-success',
            name,
            input,
            result: { output: 'wire receipt', isError: false, structuredOutput }
          }
        })
      )
      expect(html).toContain('aria-label="응답"')
      for (const text of expected) expect(html).toContain(text)
      expect(html).toContain('원문 응답')
      expect(html).toContain('&quot;structuredOutput&quot;')
      expect(html).toContain('wire receipt')
    }
  )
  it('keeps the friendly row collapsed and mounts no raw request or response by default', () => {
    const html = renderToStaticMarkup(
      createElement(WorkToolRow, {
        call: {
          ...base,
          result: { output: 'private-response', isError: false }
        }
      })
    )
    expect(html).toContain('파일 읽기 example.md')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('file_path')
    expect(html).not.toContain('private-response')
  })

  it('renders real request and response in separate labelled sections and escapes exact text', () => {
    const html = renderToStaticMarkup(
      createElement(WorkToolBody, {
        call: {
          ...base,
          result: { output: '  <script>literal</script>\nnext  ', isError: false }
        }
      })
    )
    expect(html).toContain('aria-label="요청"')
    expect(html).toContain('aria-label="응답"')
    expect(html).toContain('&quot;file_path&quot;: &quot;C:/example.md&quot;')
    expect(html).toContain('  &lt;script&gt;literal&lt;/script&gt;\nnext  ')
    expect(html).not.toContain('<script>literal</script>')
  })

  it('labels failure and pending output accurately while keeping partial error output readable', () => {
    const failed = renderToStaticMarkup(
      createElement(WorkToolBody, {
        call: {
          ...base,
          result: { output: 'partial\nfailed', isError: true }
        }
      })
    )
    expect(failed).toContain('aria-label="오류"')
    expect(failed).toContain('partial\nfailed')
    const pending = renderToStaticMarkup(createElement(WorkToolBody, { call: base }))
    expect(pending).toContain('role="status"')
    expect(pending).toContain('실행 중')
  })

  it('shows only real safe search links and keeps the original response in a closed disclosure', () => {
    const output =
      'Links: ' +
      JSON.stringify([
        { title: 'Actual source', url: 'https://example.com/docs' },
        { title: 'Unsafe source', url: 'javascript:alert(1)' }
      ])
    const html = renderToStaticMarkup(
      createElement(WorkToolBody, {
        call: {
          toolUseId: 'search-1',
          name: 'WebSearch',
          input: { query: 'docs' },
          result: { output, isError: false }
        }
      })
    )
    expect(html).toContain('검색 결과 1개')
    expect(html).toContain('href="https://example.com/docs"')
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain('원문 응답')
    expect(html).toContain('Unsafe source')
    expect(html).toContain('<details class=')
    expect(html).not.toContain('<details open')
  })
})
