import { describe, expect, it } from 'vitest'
import type { AppMessagePart } from '../../../../../shared/ipc'
import { createTaskContextSourceSelector, taskContextDirectories } from './taskContext'
import type { Message } from '../reducer/chatReducer'

const message = (...parts: AppMessagePart[]): Message => ({
  role: 'assistant',
  createdAt: 1,
  parts
})
const call = (toolRunId: string, toolName: string, args: unknown): AppMessagePart => ({
  type: 'tool_call',
  toolRunId,
  toolName,
  args
})
const result = (
  toolRunId: string,
  value: unknown = 'success',
  isError = false
): AppMessagePart => ({ type: 'tool_result', toolRunId, result: value, isError })

describe('observed Work context', () => {
  it('includes actual cwd first and deduplicates extra directories using the existing Windows path identity', () => {
    expect(
      taskContextDirectories('C:/Work', [
        'c:\\work\\',
        'C:/Reference',
        'c:/reference',
        '../relative',
        'C:/'
      ])
    ).toEqual([
      { path: 'C:/Work', working: true },
      { path: 'C:/Reference', working: false }
    ])
  })

  it('joins a successful fetched source across messages and excludes failed, pending and unsafe URLs', () => {
    const select = createTaskContextSourceSelector()
    const history = message(
      call('ok', 'WebFetch', { url: 'https://example.com/guide#top' }),
      call('dup', 'WebFetch', { url: 'https://EXAMPLE.com/guide' }),
      result('dup'),
      call('failed', 'WebFetch', { url: 'https://failed.example' }),
      result('failed', 'Error', true),
      call('pending', 'WebFetch', { url: 'https://pending.example' }),
      call('unsafe', 'WebFetch', { url: 'javascript:alert(1)' }),
      result('unsafe'),
      call('credentials', 'WebFetch', { url: 'https://user:pass@example.com' }),
      result('credentials'),
      call('plain', 'Unrecognized', { url: 'https://other.example' }),
      result('plain')
    )
    expect(select([history, message(result('ok'))])).toEqual([
      { kind: 'web', url: 'https://example.com/guide', title: 'example.com/guide' }
    ])
    expect(
      select([message(call('ok', 'WebFetch', { url: 'https://new-session.example' }))])
    ).toEqual([])
  })

  it('uses actual successful search results without confusing request text for sources', () => {
    const select = createTaskContextSourceSelector()
    expect(
      select([
        message(
          call('search', 'WebSearch', { query: 'not a source https://query.example' }),
          result(
            'search',
            'Links: [{"title":"실제 검색 결과","url":"https://docs.example/guide"}]'
          ),
          call('failed-search', 'WebSearch', {}),
          result(
            'failed-search',
            { results: [{ title: 'failed', url: 'https://failed.example' }] },
            true
          )
        )
      ])
    ).toEqual([{ kind: 'web', url: 'https://docs.example/guide', title: '실제 검색 결과' }])
  })

  it('includes only successful absolute Read inputs, deduplicating files without treating outputs as context', () => {
    const select = createTaskContextSourceSelector()
    const history = message(
      call('read', 'Read', { file_path: 'C:/Work/reference.md' }),
      call('duplicate', 'ReadFile', { path: 'c:\\work\\reference.md' }),
      result('duplicate'),
      call('unix', 'read_file', { path: '/home/user/input.txt' }),
      result('unix'),
      call('failed', 'Read', { file_path: 'C:/Work/failed.txt' }),
      result('failed', 'failed', true),
      call('pending', 'Read', { file_path: 'C:/Work/pending.txt' }),
      call('relative', 'Read', { file_path: 'reference.md' }),
      result('relative'),
      call('root', 'Read', { file_path: 'C:/' }),
      result('root'),
      call('write', 'Write', { file_path: 'C:/Work/output.md' }),
      result('write'),
      call('edit', 'Edit', { file_path: 'C:/Work/edited.md' }),
      result('edit')
    )
    expect(select([history, message(result('read'))])).toEqual([
      { kind: 'file', path: 'C:/Work/reference.md' },
      { kind: 'file', path: '/home/user/input.txt' }
    ])
    expect(select([message(call('read', 'Read', { file_path: 'C:/Other/input.md' }))])).toEqual([])
  })

  it('does not re-read completed parts when the current message changes', () => {
    let reads = 0
    const previous: Message = {
      role: 'assistant',
      createdAt: 1,
      get parts() {
        reads++
        return [call('known', 'WebFetch', { url: 'https://example.com' }), result('known')]
      }
    }
    const select = createTaskContextSourceSelector()
    select([previous])
    const initialReads = reads
    for (let i = 0; i < 5; i++) select([previous, message({ type: 'text', text: String(i) })])
    expect(reads).toBe(initialReads)
  })

  it('includes composer files and images using original names, deduplicates later reads and retains pathless history', () => {
    const attachments: AppMessagePart = {
      type: 'attachment',
      attachments: [
        {
          id: 'file',
          name: '입력 자료.pdf',
          kind: 'file',
          mimeType: 'application/pdf',
          path: 'C:/tmp/attachment-a.pdf'
        },
        {
          id: 'image',
          name: '붙여넣은 이미지.png',
          kind: 'image',
          mimeType: 'image/png',
          path: 'C:/tmp/clipboard-a.png'
        },
        { id: 'legacy', name: '과거 첨부.xlsx', kind: 'file', mimeType: 'application/octet-stream' }
      ]
    }
    const user: Message = { role: 'user', createdAt: 1, parts: [attachments] }
    const select = createTaskContextSourceSelector()
    expect(
      select([
        user,
        message(
          call('read-attachment', 'Read', { file_path: 'c:\\tmp\\attachment-a.pdf' }),
          result('read-attachment')
        ),
        { ...user, createdAt: 2 }
      ])
    ).toEqual([
      {
        kind: 'attachment',
        attachmentId: 'file',
        name: '입력 자료.pdf',
        image: false,
        path: 'C:/tmp/attachment-a.pdf'
      },
      {
        kind: 'attachment',
        attachmentId: 'image',
        name: '붙여넣은 이미지.png',
        image: true,
        path: 'C:/tmp/clipboard-a.png'
      },
      { kind: 'attachment', attachmentId: 'legacy', name: '과거 첨부.xlsx', image: false }
    ])
    expect(select([message({ type: 'text', text: '다른 세션' })])).toEqual([])
  })

  it('preserves distinct attachments with the same original filename and refuses unsafe attachment paths', () => {
    const select = createTaskContextSourceSelector()
    expect(
      select([
        {
          role: 'user',
          createdAt: 1,
          parts: [
            {
              type: 'attachment',
              attachments: [
                {
                  id: 'first',
                  name: 'report.md',
                  kind: 'file',
                  mimeType: 'text/markdown',
                  path: 'C:/tmp/first.md'
                },
                {
                  id: 'second',
                  name: 'report.md',
                  kind: 'file',
                  mimeType: 'text/markdown',
                  path: 'C:/tmp/second.md'
                },
                {
                  id: 'unsafe',
                  name: 'unsafe.md',
                  kind: 'file',
                  mimeType: 'text/markdown',
                  path: 'javascript:alert(1)'
                }
              ]
            }
          ]
        }
      ])
    ).toEqual([
      {
        kind: 'attachment',
        attachmentId: 'first',
        name: 'report.md',
        image: false,
        path: 'C:/tmp/first.md'
      },
      {
        kind: 'attachment',
        attachmentId: 'second',
        name: 'report.md',
        image: false,
        path: 'C:/tmp/second.md'
      },
      { kind: 'attachment', attachmentId: 'unsafe', name: 'unsafe.md', image: false }
    ])
  })
})
