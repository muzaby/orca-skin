// 카탈로그 목록의 그룹 구성 + 접힘 판정 (순수). renderer 의 `.tsx` 는 vitest include
// (`src/**/*.test.ts`) 밖이라 기계 검증이 안 되므로, 표에서 판정 가능한 로직만 여기로 내린다.
// 라벨은 `tr` 을 부르지 않도록 shared/i18n 의 판별 유니온 `UiMessage` 로 반환한다 —
// 스킬 그룹은 동적 sourceLabel(`{raw}`), MCP·플러그인 그룹은 카탈로그 키(`{key}`).
import type { McpServer, SkillInfo } from '../../../../../shared/ipc'
import type { UiMessage } from '../../../shared/i18n'
import type { CatalogTab } from './catalogSelection'
import type { ConnectorRow } from './pluginCatalog'

export interface CatalogGroup<T> {
  id: string
  label: UiMessage
  rows: T[]
}

// 행이 하나도 없는 그룹은 목록에 내지 않는다 (빈 표 + 빈 제목이 남는 것을 막는다).
function nonEmpty<T>(groups: CatalogGroup<T>[]): CatalogGroup<T>[] {
  return groups.filter((group) => group.rows.length > 0)
}

// 스킬 = source 별. id 는 sourceId, 라벨은 sourceLabel(동적 문자열이라 raw).
// 정렬은 라벨 기준 — 같은 source 의 스킬은 입력 순서를 보존한다.
export function skillGroups(skills: SkillInfo[]): CatalogGroup<SkillInfo>[] {
  const bySource = new Map<string, CatalogGroup<SkillInfo>>()
  for (const skill of skills) {
    const group = bySource.get(skill.sourceId)
    if (group) group.rows.push(skill)
    else
      bySource.set(skill.sourceId, {
        id: skill.sourceId,
        label: { raw: skill.sourceLabel },
        rows: [skill]
      })
  }
  return [...bySource.values()].sort((a, b) =>
    ('raw' in a.label ? a.label.raw : '').localeCompare('raw' in b.label ? b.label.raw : '')
  )
}

// MCP = 활성 상태별.
export function mcpGroups(servers: McpServer[]): CatalogGroup<McpServer>[] {
  return nonEmpty([
    {
      id: 'active',
      label: { key: 'skills.groups.activeMcp' },
      rows: servers.filter((server) => server.enabled)
    },
    {
      id: 'inactive',
      label: { key: 'skills.groups.inactiveMcp' },
      rows: servers.filter((server) => !server.enabled)
    }
  ])
}

// 서버(커넥터) = 연결 여부별 (0164 — 행이 패키지에서 커넥터로 바뀌었다).
export function pluginGroups(rows: ConnectorRow[]): CatalogGroup<ConnectorRow>[] {
  return nonEmpty([
    {
      id: 'connected',
      label: { key: 'skills.groups.connectedPlugins' },
      rows: rows.filter((row) => row.connected)
    },
    {
      id: 'disconnected',
      label: { key: 'skills.groups.disconnectedPlugins' },
      rows: rows.filter((row) => !row.connected)
    }
  ])
}

// ── 그룹 접기 ────────────────────────────────────────────────────────
// 접힌 그룹만 true 로 담는다(기본 = 펼침). 키를 탭으로 네임스페이스해 탭을 오가도
// 접힘이 유지되고, 서로 다른 탭의 동명 그룹이 간섭하지 않는다. 모달 언마운트 시
// state 가 사라지므로 영속 키 계약이 프로세스 밖으로 나가지 않는다.
export type CollapsedGroups = Readonly<Record<string, boolean>>

export function groupKey(tab: CatalogTab, groupId: string): string {
  return `${tab}:${groupId}`
}

export function isGroupOpen(collapsed: CollapsedGroups, key: string): boolean {
  return collapsed[key] !== true
}

export function toggleGroup(collapsed: CollapsedGroups, key: string): CollapsedGroups {
  return { ...collapsed, [key]: isGroupOpen(collapsed, key) }
}
