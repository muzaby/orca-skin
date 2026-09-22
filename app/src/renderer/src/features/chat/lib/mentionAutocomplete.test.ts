import { describe, expect, it } from 'vitest'
import type { FileEntry } from '../../../../../shared/ipc'
import {
  applyMentionSuggestion,
  flattenMentionGroups,
  groupMentionSuggestions,
  parseMentionToken,
  type MentionToken
} from './mentionAutocomplete'

const plugins = [
  { kind: 'plugin' as const, id: 'jira-dc', label: 'Jira' },
  { kind: 'plugin' as const, id: 'linear', label: 'Linear' }
]
const entries: FileEntry[] = [
  { name: 'README.md', isDirectory: false },
  { name: 'src', isDirectory: true },
  { name: '.env', isDirectory: false }
]

function token(text: string, caret = text.length): MentionToken {
  const parsed = parseMentionToken(text, caret)
  if (!parsed) throw new Error(`expected mention token for ${text}`)
  return parsed
}

describe('mention autocomplete parsing and projection', () => {
  it('root plain token and slash/quoted path token을 구분한다', () => {
    expect(token('hello @jir')).toMatchObject({
      partial: 'jir',
      tokenStart: 6,
      dirPath: '',
      prefix: 'jir',
      quoted: false
    })
    expect(token('@"src/rea')).toMatchObject({
      partial: 'src/rea',
      tokenStart: 0,
      dirPath: 'src',
      prefix: 'rea',
      quoted: true
    })
  })

  it('root plain은 Plugin 그룹을 먼저, 경로 그룹을 뒤에 둔다', () => {
    const groups = groupMentionSuggestions(token('@'), plugins, entries)
    expect(groups.map((group) => group.kind)).toEqual(['plugin', 'path'])
    expect(flattenMentionGroups(groups).map((item) => item.kind)).toEqual([
      'plugin',
      'plugin',
      'file',
      'file'
    ])
    expect(groups[0].suggestions.map((item) => item.kind === 'plugin' && item.id)).toEqual([
      'jira-dc',
      'linear'
    ])
  })

  it('slash/quoted path는 Plugin 그룹 없이 현재 디렉터리 후보만 낸다', () => {
    const groups = groupMentionSuggestions(token('@src/zzz'), plugins, entries)
    expect(groups).toHaveLength(1)
    expect(groups[0].kind).toBe('path')
    expect(groups[0].suggestions).toEqual([])
  })

  it('Plugin 선택은 표시 label이 아닌 id를 삽입하고 caret와 주변 문자를 보존한다', () => {
    const text = '앞 @jir 뒤'
    const mention = token('앞 @jir', '앞 @jir'.length)
    const applied = applyMentionSuggestion(text, mention.tokenStart + 4, mention, plugins[0])
    expect(applied.text).toBe('앞 @jira-dc 뒤')
    expect(applied.caret).toBe('앞 @jira-dc'.length)
  })

  it('공백 경로는 따옴표로 감싸고 기존 닫는 따옴표는 재사용한다', () => {
    const path: FileEntry = { name: 'folder name.md', isDirectory: false }
    const open = token('@"folder n')
    const applied = applyMentionSuggestion('@"folder n" tail', 10, open, {
      kind: 'file',
      entry: path,
      path: 'folder name.md'
    })
    expect(applied.text).toBe('@"folder name.md" tail')
    expect(applied.caret).toBe('@"folder name.md"'.length)
  })
})
