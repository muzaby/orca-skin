import { describe, expect, it } from 'vitest'
import type { Message } from '../reducer/chatReducer'
import { createTaskContextSourceSelector } from './taskContext'

const root = 'C:/Users/Tester/AppData/Local/Temp/orcinus-orca'
function read(path: string, id = 'read'): Message {
  return {
    role: 'assistant',
    createdAt: 1,
    parts: [
      { type: 'tool_call', toolRunId: id, toolName: 'Read', args: { file_path: path } },
      { type: 'tool_result', toolRunId: id, result: 'file contents', isError: false }
    ]
  }
}

describe('Work internal Claude context sources', () => {
  it.each([
    `${root}/claude`,
    `${root}/claude/tasks/result.output`,
    `${root.toUpperCase()}/CLAUDE/TASKS/RESULT.OUTPUT`,
    `${root}/claude/tasks/result.output`.replaceAll('/', '\\'),
    `${root}/./claude/tasks/../result.output`,
    `${root}/attachments/../claude/result.output`
  ])('excludes the internal subtree from completed Read sources: %s', (path) => {
    const history = [read(path)]
    const original = JSON.stringify(history)
    expect(createTaskContextSourceSelector()(history)).toEqual([])
    expect(JSON.stringify(history)).toBe(original)
  })

  it('retains sibling names, ordinary temp attachments, project files, and paths leaving the subtree', () => {
    const paths = [
      `${root}/claude-other/output`,
      `${root}/claude.md`,
      `${root}/attachment.pdf`,
      `${root}/claude/../input.md`,
      'C:/Work/claude/readme.md',
      'C:/Users/Tester/AppData/Local/Temp/other-app/claude/input.md'
    ]
    expect(
      createTaskContextSourceSelector()(paths.map((path, i) => read(path, String(i))))
    ).toEqual(paths.map((path) => ({ kind: 'file', path })))
  })

  it('applies the same filter to attachments without hiding pathless history or web sources', () => {
    const history: Message[] = [
      {
        role: 'user',
        createdAt: 1,
        parts: [
          {
            type: 'attachment',
            attachments: [
              {
                id: 'internal',
                name: 'result.output',
                kind: 'file',
                mimeType: 'text/plain',
                path: `${root}/claude/result.output`
              },
              {
                id: 'input',
                name: 'input.pdf',
                kind: 'file',
                mimeType: 'application/pdf',
                path: `${root}/input.pdf`
              },
              { id: 'old', name: 'old.txt', kind: 'file', mimeType: 'text/plain' }
            ]
          }
        ]
      },
      {
        role: 'assistant',
        createdAt: 2,
        parts: [
          {
            type: 'tool_call',
            toolRunId: 'web',
            toolName: 'WebFetch',
            args: { url: 'https://example.com/claude' }
          },
          { type: 'tool_result', toolRunId: 'web', result: 'page', isError: false }
        ]
      }
    ]
    expect(createTaskContextSourceSelector()(history)).toEqual([
      {
        kind: 'attachment',
        attachmentId: 'input',
        name: 'input.pdf',
        image: false,
        path: `${root}/input.pdf`
      },
      { kind: 'attachment', attachmentId: 'old', name: 'old.txt', image: false },
      { kind: 'web', url: 'https://example.com/claude', title: 'example.com/claude' }
    ])
  })

  it('keeps internal late results out after cached pending reads and a fresh history replay', () => {
    const complete = read(`${root}/claude/tasks/late.output`)
    const pending = { ...complete, parts: complete.parts.slice(0, 1) }
    const late = { ...complete, createdAt: 2, parts: complete.parts.slice(1) }
    const select = createTaskContextSourceSelector()
    expect(select([pending])).toEqual([])
    expect(select([pending, late])).toEqual([])
    expect(createTaskContextSourceSelector()(JSON.parse(JSON.stringify([pending, late])))).toEqual(
      []
    )
  })
})
