// 0259 AC1~AC5 · VP-08 — '+' 메뉴 트리.
import { describe, expect, it } from 'vitest'
import type { SkillInfo } from '../../../../../shared/ipc'
import { attachMenuToken, buildAttachMenu, skillTooltip } from './attachMenuModel'

const labels = {
  addFiles: '파일 또는 사진 추가',
  skills: '스킬',
  plugins: '플러그인',
  managePlugins: '플러그인 관리',
  noSkills: '사용 가능한 스킬 없음',
  noPlugins: '사용 가능한 플러그인 없음'
}
const skill = (name: string, sourceId: string, sourceLabel: string, description = ''): SkillInfo =>
  ({ name, sourceId, sourceLabel, description }) as SkillInfo
const skills = [
  skill('a', 'orca', 'Orcinus orca 스킬', '설명 A'),
  skill('b', 'orca', 'Orcinus orca 스킬'),
  skill('c', 'adapter:claude', 'CLAUDE 스킬', '설명 C')
]
const plugins = [
  { kind: 'plugin' as const, id: 'confluence', label: 'Confluence' },
  { kind: 'plugin' as const, id: 'jira', label: 'Jira' }
]

describe('buildAttachMenu', () => {
  const tree = buildAttachMenu({ skills, plugins, labels, canManagePlugins: true })

  it('최상위 = 파일 추가 · 구분선 · 스킬 ▸ · 플러그인 ▸ (AC1)', () => {
    expect(tree.map((item) => [item.kind, 'label' in item ? item.label : null])).toEqual([
      ['action', '파일 또는 사진 추가'],
      ['separator', null],
      ['submenu', '스킬'],
      ['submenu', '플러그인']
    ])
  })

  it('스킬 ▸ 출처 ▸ 스킬 이름 (AC2)', () => {
    const skillsMenu = tree[2]
    if (skillsMenu.kind !== 'submenu') throw new Error('skills')
    expect(
      skillsMenu.items.map((group) =>
        group.kind === 'submenu'
          ? [group.label, group.items.map((i) => ('label' in i ? i.label : ''))]
          : null
      )
    ).toEqual([
      ['Orcinus orca 스킬', ['a', 'b']],
      ['CLAUDE 스킬', ['c']]
    ])
  })

  it('플러그인 ▸ 목록 · 구분선 · 플러그인 관리 (AC3)', () => {
    const pluginsMenu = tree[3]
    if (pluginsMenu.kind !== 'submenu') throw new Error('plugins')
    expect(pluginsMenu.items.map((i) => (i.kind === 'action' ? i.action : i.kind))).toEqual([
      { type: 'plugin', id: 'confluence' },
      { type: 'plugin', id: 'jira' },
      'separator',
      { type: 'managePlugins' }
    ])
    const noManage = buildAttachMenu({ skills, plugins, labels, canManagePlugins: false })[3]
    expect(noManage.kind === 'submenu' && noManage.items).toHaveLength(2)
  })

  it('빈 상태 행 (AC4)', () => {
    const empty = buildAttachMenu({ skills: [], plugins: [], labels, canManagePlugins: true })
    const [, , s, p] = empty
    expect(s.kind === 'submenu' && s.items).toEqual([
      { kind: 'empty', id: 'skills:empty', label: '사용 가능한 스킬 없음' }
    ])
    expect(p.kind === 'submenu' && p.items.map((i) => i.kind)).toEqual([
      'empty',
      'separator',
      'action'
    ])
  })

  it('hover 설명: 스킬 = 설명⏎출처, 설명 없으면 출처 · 플러그인 = 라벨 (AC5)', () => {
    expect(skillTooltip(skills[0])).toBe('설명 A\nOrcinus orca 스킬')
    expect(skillTooltip(skills[1])).toBe('Orcinus orca 스킬')
    const s = tree[2]
    const first = s.kind === 'submenu' && s.items[0].kind === 'submenu' ? s.items[0].items[0] : null
    expect(first?.kind === 'action' && first.title).toBe('설명 A\nOrcinus orca 스킬')
    const p = tree[3]
    expect(p.kind === 'submenu' && p.items[0].kind === 'action' && p.items[0].title).toBe(
      'Confluence'
    )
  })
})

describe('attachMenuToken (AC2·AC3)', () => {
  it('스킬 = /이름, 플러그인 = @id, 그 밖 = 토큰 없음', () => {
    expect(attachMenuToken({ type: 'skill', name: 'review' })).toBe('/review')
    expect(attachMenuToken({ type: 'plugin', id: 'jira' })).toBe('@jira')
    expect(attachMenuToken({ type: 'attach' })).toBeNull()
    expect(attachMenuToken({ type: 'managePlugins' })).toBeNull()
  })
})
