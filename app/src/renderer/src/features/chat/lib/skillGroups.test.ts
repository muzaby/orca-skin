// 0259 AC9 · VP-11 — `/` 자동완성 출처 섹션 · 인덱스 순서.
import { describe, expect, it } from 'vitest'
import type { SkillInfo } from '../../../../../shared/ipc'
import { groupSkillSuggestions } from './skillGroups'

const s = (name: string, sourceId: string, sourceLabel: string): SkillInfo =>
  ({ name, sourceId, sourceLabel }) as SkillInfo

describe('groupSkillSuggestions', () => {
  it('연속한 같은 출처를 한 섹션으로 묶고 평면 인덱스를 그대로 둔다', () => {
    const sections = groupSkillSuggestions([
      s('a', 'adapter:claude', 'Claude'),
      s('b', 'plugin:claude', 'Claude'),
      s('c', 'orca', 'Orcinus orca'),
      s('d', 'adapter:claude', 'Claude')
    ])
    expect(sections.map((x) => [x.label, x.items.map((i) => [i.skill.name, i.index])])).toEqual([
      [
        'Claude',
        [
          ['a', 0],
          ['b', 1]
        ]
      ],
      ['Orcinus orca', [['c', 2]]],
      ['Claude', [['d', 3]]]
    ])
  })
  it('화면 순서 = 인덱스 순서(0,1,2…)', () => {
    const sections = groupSkillSuggestions([
      s('z', 'adapter:claude', 'Claude'),
      s('a', 'orca', 'Orcinus orca'),
      s('b', 'orca', 'Orcinus orca')
    ])
    expect(sections.flatMap((x) => x.items.map((i) => i.index))).toEqual([0, 1, 2])
  })
})
