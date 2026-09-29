import { describe, expect, it } from 'vitest'
import { resolveArchiveMailRelations, type ArchiveMailRelationMessage } from './relations'

function message(
  id: string,
  messageId: string | null,
  inReplyTo: string | null = null,
  references: string | null = null
): ArchiveMailRelationMessage {
  return { id, messageId, inReplyTo, references }
}

describe('mail archive confirmed relations', () => {
  it('resolves explicit Reply and References headers regardless of collection order', () => {
    const relations = resolveArchiveMailRelations([
      message(
        'reply',
        '<reply@example.test>',
        '<parent@example.test>',
        '<root@example.test> <parent@example.test>'
      ),
      message('parent', '<parent@example.test>', '<root@example.test>'),
      message('root', '<root@example.test>')
    ])

    expect(relations).toEqual([
      {
        childMailId: 'parent',
        parentMessageId: 'root@example.test',
        parentMailId: 'root',
        kind: 'reply',
        resolution: 'resolved'
      },
      {
        childMailId: 'reply',
        parentMessageId: 'parent@example.test',
        parentMailId: 'parent',
        kind: 'reply',
        resolution: 'resolved'
      },
      {
        childMailId: 'reply',
        parentMessageId: 'parent@example.test',
        parentMailId: 'parent',
        kind: 'reference',
        resolution: 'resolved'
      },
      {
        childMailId: 'reply',
        parentMessageId: 'root@example.test',
        parentMailId: 'root',
        kind: 'reference',
        resolution: 'resolved'
      }
    ])
  })

  it('keeps missing and ambiguous parents unresolved and ignores subject-only similarity', () => {
    const relations = resolveArchiveMailRelations([
      message('reply', '<reply@example.test>', '<missing@example.test>'),
      message('duplicate-a', '<duplicate@example.test>'),
      message('duplicate-b', '<DUPLICATE@example.test>'),
      message('ambiguous-reply', '<ambiguous@example.test>', '<duplicate@example.test>')
    ])

    expect(relations).toEqual([
      {
        childMailId: 'ambiguous-reply',
        parentMessageId: 'duplicate@example.test',
        parentMailId: null,
        kind: 'reply',
        resolution: 'ambiguous'
      },
      {
        childMailId: 'reply',
        parentMessageId: 'missing@example.test',
        parentMailId: null,
        kind: 'reply',
        resolution: 'missing'
      }
    ])
  })

  it('rejects self edges and cycles while remaining deterministic', () => {
    const messages = [
      message('a', '<a@example.test>', '<b@example.test>'),
      message('b', '<b@example.test>', '<a@example.test>'),
      message('self', '<self@example.test>', '<self@example.test>')
    ]
    const first = resolveArchiveMailRelations(messages)
    const second = resolveArchiveMailRelations([...messages].reverse())

    expect(first).toEqual(second)
    expect(first.filter((edge) => edge.resolution === 'resolved')).toHaveLength(1)
    expect(first.map((edge) => edge.resolution).sort()).toEqual(['cycle', 'resolved', 'self'])
  })
})
