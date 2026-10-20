// 컴포저 '+' 메뉴 트리 — 출처 제목 아래 모든 스킬·MCP·플러그인을 직접 나열하는 순수 함수.
// 자동완성의 검색 필터와 별도로 전체 catalog를 받는다.
import type { SkillInfo } from '../../../../../shared/ipc'
import type { ReactNode } from 'react'
import type { CascadeItem } from '../../../shared/ui/cascadeMenuState'
import type { PluginMention } from './pluginMention'
import type { NativeResourcesView } from '../hooks/useNativeResources'
import type { NativeResource } from '../../../../../shared/native-resources'
import { sourceSkills } from '../../../../../shared/extension-sources'

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
  useMcp?: (name: string) => string
  sourceIcon?: (source: string) => ReactNode
  native?: {
    label: string
    backend?: 'claude' | 'opencode'
    items: CascadeItem<AttachMenuAction>[]
    skills: CascadeItem<AttachMenuAction>[]
    orcaItems?: CascadeItem<AttachMenuAction>[]
  }
}): CascadeItem<AttachMenuAction>[] {
  const { labels, canManagePlugins } = input
  const backend =
    input.native?.backend ?? (input.native?.label === 'OpenCode' ? 'opencode' : 'claude')
  const skills = sourceSkills(input.skills, backend).filter(
    (skill) => skill.sourceId !== `plugin:${backend}` || !input.native
  )
  const catalogNames = new Set(skills.map((skill) => skill.name))
  const plugins = input.includeExtensions === false ? [] : input.plugins
  const attachment: CascadeItem<AttachMenuAction> = {
    kind: 'action',
    id: 'attach',
    label: labels.addFiles,
    icon: 'attachFile',
    action: { type: 'attach' }
  }
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
      : [...bySource].flatMap(([sourceId, group]): CascadeItem<AttachMenuAction>[] => [
          {
            kind: 'heading',
            id: `skills:${sourceId}`,
            label: group.label,
            leading: input.sourceIcon?.(sourceId)
          },
          ...group.skills.map((skill) => ({
            kind: 'action' as const,
            id: `skill:${sourceId}/${skill.name}`,
            label: skill.name,
            icon: 'bolt' as const,
            title: skillTooltip(skill),
            disabled:
              skill.enabled === false ||
              (skill.sourceId === 'orca' && input.includeExtensions === false),
            action: {
              type: skill.sourceId === 'orca' ? ('skill' as const) : ('nativeCommand' as const),
              name: skill.name
            }
          }))
        ])

  const pluginItems: CascadeItem<AttachMenuAction>[] =
    plugins.length === 0
      ? [{ kind: 'empty', id: 'plugins:empty', label: labels.noPlugins }]
      : plugins.map((plugin) => ({
          kind: 'action' as const,
          id: `plugin:${plugin.id}`,
          label: plugin.label,
          icon: 'electricalServices' as const,
          title: plugin.label,
          disabled: input.includeExtensions === false,
          action: { type: 'plugin' as const, id: plugin.id }
        }))
  if (input.includeExtensions !== false && input.native?.orcaItems?.length) {
    if (!plugins.length) pluginItems.length = 0
    pluginItems.unshift(...input.native.orcaItems)
  }
  // Settings-only MCP rows have no connection observation and cannot be offered as usable.
  if (plugins.length || (input.includeExtensions !== false && input.native?.orcaItems?.length))
    pluginItems.unshift({
      kind: 'heading',
      id: 'plugins:orca',
      label: 'Orcinus orca 플러그인',
      leading: input.sourceIcon?.('orca')
    })
  if (input.native) {
    if (bySource.size === 0) skillItems.length = 0
    let heading: Extract<CascadeItem<AttachMenuAction>, { kind: 'heading' }> | undefined
    for (const item of input.native.skills) {
      if (item.kind === 'heading') {
        heading = { ...item, leading: input.sourceIcon?.('native') }
        continue
      }
      if (
        item.kind === 'action' &&
        item.action.type === 'nativeCommand' &&
        catalogNames.has(item.action.name)
      )
        continue
      if (!heading) {
        skillItems.push(item)
        continue
      }
      let at = skillItems.findIndex((row) => row.kind === 'heading' && row.label === heading!.label)
      if (at < 0) {
        skillItems.push(heading)
        at = skillItems.length - 1
      }
      let end = at + 1
      while (end < skillItems.length && skillItems[end].kind !== 'heading') end++
      skillItems.splice(end, 0, item)
    }
    if (
      plugins.length === 0 &&
      !(input.includeExtensions !== false && input.native.orcaItems?.length)
    )
      pluginItems.length = 0
    if (input.native.items.length)
      pluginItems.unshift(
        {
          kind: 'heading',
          id: 'native',
          label: `${input.native.label} MCP`,
          leading: input.sourceIcon?.('native')
        },
        ...input.native.items
      )
  }
  if (!skillItems.length)
    skillItems.push({ kind: 'empty', id: 'skills:empty', label: labels.noSkills })
  if (!pluginItems.length)
    pluginItems.push({ kind: 'empty', id: 'plugins:empty', label: labels.noPlugins })
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
    {
      kind: 'submenu' as const,
      id: 'skills',
      label: labels.skills,
      icon: 'bolt' as const,
      items: skillItems
    },
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
    loading?: string
    error?: string
    partial?: string
    notice?: string
    noCommands?: string
    useMcp: (name: string) => string
    resourceStatus: (status: NativeResource['status']) => string
    harness?: string
  },
  kind: 'skills' | 'mcp',
  origin?: 'orca'
): CascadeItem<AttachMenuAction>[] {
  const items: CascadeItem<AttachMenuAction>[] = []
  if (view.status === 'ready') {
    const commands = view.value.commands ?? []
    const children: CascadeItem<AttachMenuAction>[] = view.value.items
      .filter(
        (item) =>
          kind === 'mcp' &&
          item.kind === 'mcp' &&
          item.origin === origin &&
          view.value.state === 'connected' &&
          item.status === 'connected' &&
          item.enabled
      )
      .map((item) => ({
        kind: 'action',
        id: `native-resource:${kind}:${item.id}`,
        label: item.name,
        action: { type: 'nativePrompt', text: labels.useMcp(item.name) }
      }))
    const groups = new Map<string, CascadeItem<AttachMenuAction>[]>()
    for (const command of commands.filter((command) =>
      kind === 'mcp' ? false : command.source !== 'mcp' && command.skill !== false
    )) {
      const group = `${labels.harness ?? 'Claude'} ${command.source === 'plugin' ? '플러그인' : '스킬'}`
      const row: CascadeItem<AttachMenuAction> = {
        kind: 'action',
        id: `native-command:${command.name}`,
        label: kind === 'skills' ? command.name.replace(/:+/g, '::') : `/${command.name}`,
        icon: kind === 'skills' ? 'bolt' : 'electricalServices',
        title:
          [command.description, command.argumentHint].filter(Boolean).join('\n') || command.name,
        action: { type: 'nativeCommand', name: command.name }
      }
      if (kind === 'mcp') children.push(row)
      else {
        const existing = groups.get(group)
        if (existing) existing.push(row)
        else groups.set(group, [row])
      }
    }
    for (const [group, rows] of groups)
      items.push({ kind: 'heading', id: `native-skills:${group}`, label: group }, ...rows)
    items.push(...children)
  }
  return items
}
