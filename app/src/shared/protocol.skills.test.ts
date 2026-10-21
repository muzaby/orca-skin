import { describe, expect, it } from 'vitest'
import { AuthorSkillSchema, SetSkillEnabledSchema, SkillTargetSchema } from './protocol'

describe('skill names at IPC boundaries', () => {
  it.each([
    'superpowers:using-superpowers',
    'plugin:group:command',
    'Review changes.md',
    '한글 스킬',
    `plugin:${'long-name-'.repeat(10)}`,
    ' exact catalog key '
  ])('preserves the catalog identity %j without applying authoring rules', (name) => {
    const target = { name, sourceId: 'plugin:claude' }
    expect(SkillTargetSchema.parse(target)).toEqual(target)
    expect(SetSkillEnabledSchema.parse({ ...target, enabled: false })).toEqual({
      ...target,
      enabled: false
    })
  })

  it.each([
    {},
    { name: '', sourceId: 'plugin:claude' },
    { name: null, sourceId: 'plugin:claude' },
    { name: 42, sourceId: 'plugin:claude' },
    { name: 'review', sourceId: '' },
    { name: 'review', sourceId: 'x'.repeat(129) }
  ])('rejects malformed targets %j', (target) => {
    expect(SkillTargetSchema.safeParse(target).success).toBe(false)
  })

  it.each(['review', 'Review_12-test', 'a'.repeat(64), ' trimmed '])(
    'keeps authored directory names valid: %j',
    (name) => {
      expect(AuthorSkillSchema.parse({ name, description: 'A', body: '' }).name).toBe(name.trim())
    }
  )

  it.each([
    '',
    ' ',
    'superpowers:using-superpowers',
    '../review',
    'a/b',
    'a\\b',
    '한글',
    'a b',
    'a'.repeat(65)
  ])('rejects unsafe or unsupported authored directory names: %j', (name) => {
    expect(AuthorSkillSchema.safeParse({ name, description: 'A', body: '' }).success).toBe(false)
  })
})
