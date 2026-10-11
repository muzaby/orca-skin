// 컴포저 '+' 메뉴 트리(0259 D-001~D-006·D-009) — 순수 함수. 스킬·플러그인 목록은 기존 출처를
// 그대로 받는다(스킬 = `/` 자동완성과 같은 useSkills, 플러그인 = `@` 후보와 같은 함수).
import type { SkillInfo } from '../../../../../shared/ipc'
import type { CascadeItem } from '../../../shared/ui/cascadeMenuState'
import type { PluginMention } from './pluginMention'

export type AttachMenuAction =
  | { type: 'attach' }
  | { type: 'skill'; name: string }
  | { type: 'plugin'; id: string }
  | { type: 'managePlugins' }

export interface AttachMenuLabels {
  addFiles: string
  skills: string
  plugins: string
  managePlugins: string
  noSkills: string
  noPlugins: string
}

/** 메뉴 선택 → 입력창에 넣을 토큰. 파일 추가·플러그인 관리는 토큰이 없다. */
export function attachMenuToken(action: AttachMenuAction): string | null {
  if (action.type === 'skill') return `/${action.name}`
  if (action.type === 'plugin') return `@${action.id}`
  return null
}

/** 스킬 hover 설명: `설명⏎출처 라벨`(설명이 비면 출처만) — 첨부 10 툴팁 형태. */
export function skillTooltip(skill: Pick<SkillInfo, 'description' | 'sourceLabel'>): string {
  const description = skill.description.trim()
  return description ? `${description}\n${skill.sourceLabel}` : skill.sourceLabel
}

export function buildAttachMenu(input: {
  skills: readonly SkillInfo[]
  plugins: readonly PluginMention[]
  labels: AttachMenuLabels
  canManagePlugins: boolean
}): CascadeItem<AttachMenuAction>[] {
  const { skills, plugins, labels, canManagePlugins } = input

  // 출처별 그룹 — 처음 나온 순서를 지킨다(목록은 출처 라벨 → 이름 순으로 온다).
  const bySource = new Map<string, { label: string; skills: SkillInfo[] }>()
  for (const skill of skills) {
    const group = bySource.get(skill.sourceId)
    if (group) group.skills.push(skill)
    else bySource.set(skill.sourceId, { label: skill.sourceLabel, skills: [skill] })
  }
  const skillItems: CascadeItem<AttachMenuAction>[] =
    bySource.size === 0
      ? [{ kind: 'empty', id: 'skills:empty', label: labels.noSkills }]
      : [...bySource].map(([sourceId, group]) => ({
          kind: 'submenu' as const,
          id: `skills:${sourceId}`,
          label: group.label,
          items: group.skills.map((skill) => ({
            kind: 'action' as const,
            id: `skill:${sourceId}/${skill.name}`,
            label: skill.name,
            icon: 'bolt' as const,
            title: skillTooltip(skill),
            action: { type: 'skill' as const, name: skill.name }
          }))
        }))

  const pluginItems: CascadeItem<AttachMenuAction>[] =
    plugins.length === 0
      ? [{ kind: 'empty', id: 'plugins:empty', label: labels.noPlugins }]
      : plugins.map((plugin) => ({
          kind: 'action' as const,
          id: `plugin:${plugin.id}`,
          label: plugin.label,
          icon: 'electricalServices' as const,
          title: plugin.label,
          action: { type: 'plugin' as const, id: plugin.id }
        }))
  if (canManagePlugins)
    pluginItems.push(
      { kind: 'separator', id: 'plugins:separator' },
      {
        kind: 'action',
        id: 'plugins:manage',
        label: labels.managePlugins,
        icon: 'settings',
        action: { type: 'managePlugins' }
      }
    )

  return [
    {
      kind: 'action',
      id: 'attach',
      label: labels.addFiles,
      icon: 'plus',
      action: { type: 'attach' }
    },
    { kind: 'separator', id: 'separator' },
    { kind: 'submenu', id: 'skills', label: labels.skills, icon: 'bolt', items: skillItems },
    {
      kind: 'submenu',
      id: 'plugins',
      label: labels.plugins,
      icon: 'electricalServices',
      items: pluginItems
    }
  ]
}
