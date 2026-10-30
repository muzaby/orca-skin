// 컴포저 '+' 메뉴 트리 — 출처 제목 아래 모든 스킬·MCP·플러그인을 직접 나열하는 순수 함수.
// 자동완성의 검색 필터와 별도로 전체 catalog를 받는다.
import type { SkillInfo } from '../../../../../shared/ipc'
import type { ReactNode } from 'react'
import type { CascadeItem } from '../../../shared/ui/cascadeMenuState'
import { pluginMentionToken, type PluginMention } from './pluginMention'
import type { NativeResourcesView } from '../hooks/useNativeResources'
import type { NativeResource } from '../../../../../shared/native-resources'
import {
  sourceSkills,
  extensionSourceLabels,
  harnessSourceTitle
} from '../../../../../shared/extension-sources'

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
  if (action.type === 'plugin') return pluginMentionToken(action.id)
  if (action.type === 'nativeCommand') return `/${action.name}`
  if (action.type === 'nativePrompt') return action.text
  return null
}

/** 스킬 hover 설명: `설명⏎출처 라벨`(설명이 비면 출처만) — 첨부 10 툴팁 형태. */
export function skillTooltip(skill: Pick<SkillInfo, 'description' | 'sourceLabel'>): string {
  const description = skill.description.trim()
  return description ? `${description}\n${skill.sourceLabel}` : skill.sourceLabel
}

// `Orcinus orca` 그룹(heading + 다음 heading 전까지의 항목)을 패널 맨 앞으로 옮긴다(0291 D-017 —
// 플러그인 탭과 같은 규칙). 나머지 그룹의 상대 순서와 항목은 그대로다. 그룹이 없으면 입력 그대로.
export function orcaGroupFirst<T>(
  items: readonly CascadeItem<T>[],
  headingId: string
): CascadeItem<T>[] {
  const start = items.findIndex((item) => item.kind === 'heading' && item.id === headingId)
  if (start <= 0) return [...items]
  let end = start + 1
  while (end < items.length && items[end]!.kind !== 'heading') end++
  return [...items.slice(start, end), ...items.slice(0, start), ...items.slice(end)]
}

export function buildAttachMenu(input: {
  skills: readonly SkillInfo[]
  plugins: readonly PluginMention[]
  labels: AttachMenuLabels
  canManagePlugins: boolean
  includeExtensions?: boolean
  includeSkills?: boolean
  includeManagedMcp?: boolean
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
  const includeSkills = input.includeSkills ?? input.includeExtensions ?? true
  const includeManagedMcp = input.includeManagedMcp ?? input.includeExtensions ?? true
  const backend =
    input.native?.backend ?? (input.native?.label === 'OpenCode' ? 'opencode' : 'claude')
  const skills = sourceSkills(input.skills, backend).filter(
    (skill) => skill.sourceId !== `plugin:${backend}` || !input.native
  )
  const catalogNames = new Set(skills.map((skill) => skill.name))
  const observedIds = new Set(
    input.native?.orcaItems
      ?.filter((item) => item.kind === 'action' && item.action.type === 'plugin')
      .map((item) =>
        item.kind === 'action' && item.action.type === 'plugin' ? item.action.id : ''
      )
  )
  const plugins = includeManagedMcp
    ? input.plugins.filter((plugin) => !observedIds.has(plugin.id))
    : []
  const attachment: CascadeItem<AttachMenuAction> = {
    kind: 'action',
    id: 'attach',
    label: labels.addFiles,
    icon: 'attachFile',
    action: { type: 'attach' }
  }
  // 제목별 그룹 — 처음 나온 순서와 각 항목의 출처 식별자를 지킨다.
  const bySource = new Map<string, { label: string; skills: SkillInfo[] }>()
  for (const skill of skills) {
    const group = bySource.get(skill.sourceLabel)
    if (group) group.skills.push(skill)
    else bySource.set(skill.sourceLabel, { label: skill.sourceLabel, skills: [skill] })
  }
  const skillItems: CascadeItem<AttachMenuAction>[] =
    bySource.size === 0
      ? [{ kind: 'empty', id: 'skills:empty', label: labels.noSkills }]
      : [...bySource.values()].flatMap((group): CascadeItem<AttachMenuAction>[] => [
          {
            kind: 'heading',
            id: `skills:${group.skills[0].sourceId}`,
            label: group.label,
            leading: input.sourceIcon?.(group.skills[0].sourceId)
          },
          ...group.skills.map((skill) => ({
            kind: 'action' as const,
            id: `skill:${skill.sourceId}/${skill.name}`,
            label: skill.name,
            icon: 'bolt' as const,
            title: skillTooltip(skill),
            disabled: skill.enabled === false || (skill.sourceId === 'orca' && !includeSkills),
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
          disabled: !includeManagedMcp,
          action: { type: 'plugin' as const, id: plugin.id }
        }))
  if (includeManagedMcp && input.native?.orcaItems?.length) {
    if (!plugins.length) pluginItems.length = 0
    pluginItems.unshift(...input.native.orcaItems)
  }
  // Settings-only MCP rows have no connection observation and cannot be offered as usable.
  if (plugins.length || (includeManagedMcp && input.native?.orcaItems?.length))
    pluginItems.unshift({
      kind: 'heading',
      id: 'plugins:orca',
      label: extensionSourceLabels.orca,
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
    if (plugins.length === 0 && !(includeManagedMcp && input.native.orcaItems?.length))
      pluginItems.length = 0
    if (input.native.items.length)
      pluginItems.unshift(
        {
          kind: 'heading',
          id: 'native',
          label: input.native.label,
          leading: input.sourceIcon?.('native')
        },
        ...input.native.items
      )
  }
  const orderedSkills = orcaGroupFirst(skillItems, 'skills:orca')
  skillItems.length = 0
  skillItems.push(...orderedSkills)
  const orderedPlugins = orcaGroupFirst(pluginItems, 'plugins:orca')
  pluginItems.length = 0
  pluginItems.push(...orderedPlugins)
  if (!skillItems.length)
    skillItems.push({ kind: 'empty', id: 'skills:empty', label: labels.noSkills })
  if (!pluginItems.length)
    pluginItems.push({ kind: 'empty', id: 'plugins:empty', label: labels.noPlugins })
  if (canManagePlugins && includeManagedMcp)
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

/** The menu and decoration share the same observed, usable native MCP membership. */
export function nativePluginMentions(view: NativeResourcesView, origin?: 'orca'): PluginMention[] {
  if (view.status !== 'ready' || view.value.state !== 'connected') return []
  return view.value.items
    .filter(
      (item) =>
        item.kind === 'mcp' && item.origin === origin && item.status === 'connected' && item.enabled
    )
    .map((item) => ({
      kind: 'plugin',
      id: item.mentionId ?? item.id,
      label: item.name,
      ...(item.managedSource ? { displayName: item.name } : {})
    }))
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
    const children: CascadeItem<AttachMenuAction>[] =
      kind === 'mcp'
        ? nativePluginMentions(view, origin).map((plugin) => ({
            kind: 'action',
            id: `native-resource:${kind}:${plugin.id}`,
            label: plugin.label,
            action: { type: 'plugin', id: plugin.id }
          }))
        : []
    const groups = new Map<string, CascadeItem<AttachMenuAction>[]>()
    for (const command of commands.filter((command) =>
      kind === 'mcp' ? false : command.source !== 'mcp' && command.skill !== false
    )) {
      const group = labels.harness ?? harnessSourceTitle('claude')
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
