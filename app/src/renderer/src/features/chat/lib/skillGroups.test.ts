// 0259 AC9 · VP-11 — `/` 자동완성 출처 섹션 · 인덱스 순서.
import { describe, expect, it } from 'vitest'
import type { SkillInfo } from '../../../../../shared/ipc'
import { groupSkillSuggestions } from './skillGroups'

const s = (name: string, sourceId: string, sourceLabel: string): SkillInfo =>
  ({ name, sourceId, sourceLabel }) as SkillInfo

describe('groupSkillSuggestions', () => {
  it('연속한 같은 출처를 한 섹션으로 묶고 평면 인덱스를 그대로 둔다', () => {
    const sections = groupSkillSuggestions([
      s('a', 'orca', 'Orcinus orca 스킬'),
      s('b', 'orca', 'Orcinus orca 스킬'),
      s('c', 'adapter:claude', 'CLAUDE 스킬')
    ])
    expect(sections.map((x) => [x.label, x.items.map((i) => [i.skill.name, i.index])])).toEqual([
      [
        'Orcinus orca 스킬',
        [
          ['a', 0],
          ['b', 1]
        ]
      ],
      ['CLAUDE 스킬', [['c', 2]]]
    ])
  })
  it('화면 순서 = 인덱스 순서(0,1,2…)', () => {
    const sections = groupSkillSuggestions([
      s('z', 'adapter:claude', 'CLAUDE 스킬'),
      s('a', 'orca', 'Orcinus orca 스킬'),
      s('b', 'orca', 'Orcinus orca 스킬')
    ])
    expect(sections.flatMap((x) => x.items.map((i) => i.index))).toEqual([0, 1, 2])
  })
})
