// 컴포저 '+' 메뉴 트리(0259 D-001~D-006·D-009) — 순수 함수. 스킬·플러그인 목록은 기존 출처를
// 그대로 받는다(스킬 = `/` 자동완성과 같은 useSkills, 플러그인 = `@` 후보와 같은 함수).
import type { SkillInfo } from '../../../../../shared/ipc'
import type { CascadeItem } from '../../../shared/ui/cascadeMenuState'
import type { PluginMention } from './pluginMention'
import type { NativeResourcesView } from '../hooks/useNativeResources'
import type { NativeResource } from '../../../../../shared/native-resources'

export type AttachMenuAction =
  | { type: 'attach' }
  | { type: 'skill'; name: string }
  | { type: 'plugin'; id: string }
  | { type: 'managePlugins' }
  | { type: 'nativeCommand'; name: string }
  | { type: 'nativePrompt'; text: string }

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
  if (action.type === 'nativeCommand') return `/${action.name}`
  if (action.type === 'nativePrompt') return action.text
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
  includeExtensions?: boolean
  native?: {
    label: string
    items: CascadeItem<AttachMenuAction>[]
    skills: CascadeItem<AttachMenuAction>[]
  }
}): CascadeItem<AttachMenuAction>[] {
  const { skills, plugins, labels, canManagePlugins } = input
  const attachment: CascadeItem<AttachMenuAction> = {
    kind: 'action',
    id: 'attach',
    label: labels.addFiles,
    icon: 'plus',
    action: { type: 'attach' }
  }
  if (input.includeExtensions === false && !input.native) return [attachment]

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
  if (input.native) {
    if (bySource.size === 0) skillItems.length = 0
    skillItems.unshift(...input.native.skills)
    if (plugins.length === 0) pluginItems.length = 0
    pluginItems.unshift({
      kind: 'submenu',
      id: 'native',
      label: input.native.label,
      items: input.native.items
    })
  }
  if (canManagePlugins && input.includeExtensions !== false)
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
    attachment,
    { kind: 'separator', id: 'separator' },
    ...(input.includeExtensions !== false || input.native
      ? [
          {
            kind: 'submenu' as const,
            id: 'skills',
            label: labels.skills,
            icon: 'bolt' as const,
            items: skillItems
          }
        ]
      : []),
    {
      kind: 'submenu',
      id: 'plugins',
      label: labels.plugins,
      icon: 'electricalServices',
      items: pluginItems
    }
  ]
}

export function nativeAttachItems(
  view: NativeResourcesView,
  labels: {
    loading: string
    error: string
    partial: string
    notice?: string
    noCommands: string
    useMcp: (name: string) => string
    resourceStatus: (status: NativeResource['status']) => string
  },
  kind: 'skills' | 'mcp'
): CascadeItem<AttachMenuAction>[] {
  const items: CascadeItem<AttachMenuAction>[] = []
  if (view.status !== 'ready') {
    items.push({ kind: 'empty', id: view.status, label: labels[view.status] })
  } else {
    const commands = view.value.commands ?? []
    const children: CascadeItem<AttachMenuAction>[] = view.value.items
      .filter((item) => kind === 'mcp' && item.kind === 'mcp')
      .map((item) => ({
        kind: 'action',
        id: `native-resource:${kind}:${item.id}`,
        label: item.name,
        description: labels.resourceStatus(item.status),
        disabled: item.status !== 'connected',
        title:
          item.status === 'connected'
            ? labels.useMcp(item.name)
            : labels.resourceStatus(item.status),
        action: { type: 'nativePrompt', text: labels.useMcp(item.name) }
      }))
    children.push(
      ...commands
        .filter((command) => (kind === 'mcp' ? command.source === 'mcp' : command.source !== 'mcp'))
        .map((command): CascadeItem<AttachMenuAction> => ({
          kind: 'action',
          id: `native-command:${command.name}`,
          label: kind === 'skills' ? command.name.replace(/:+/g, '::') : `/${command.name}`,
          icon: kind === 'skills' ? 'bolt' : 'electricalServices',
          title:
            [command.description, command.argumentHint].filter(Boolean).join('\n') || command.name,
          action: { type: 'nativeCommand', name: command.name }
        }))
    )
    if (!children.length)
      children.push({ kind: 'empty', id: `${kind}:empty`, label: labels.noCommands })
    if (kind === 'skills') items.push(...children)
    else
      items.push({
        kind: 'submenu',
        id: `native:${kind}`,
        label: 'MCP',
        icon: 'electricalServices',
        items: children
      })
  }
  // Keep submenu indices stable as a refresh notice appears/disappears while open.
  const notice =
    labels.notice ?? (view.status === 'ready' && view.value.partial ? labels.partial : undefined)
  if (notice) items.push({ kind: 'empty', id: 'notice', label: notice })
  return items
}
