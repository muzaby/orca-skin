// 카탈로그 목록의 그룹 구성과 순서 판정 (순수). 평탄한 목록도 같은 정렬 순서를 재사용한다.
// 라벨은 `tr` 을 부르지 않도록 shared/i18n 의 판별 유니온 `UiMessage` 로 반환한다 —
// 스킬 그룹은 동적 sourceLabel(`{raw}`), MCP·플러그인 그룹은 카탈로그 키(`{key}`).
import type { McpServer, ProviderInfo, SkillInfo } from '../../../../../shared/ipc'
import type { UiMessage } from '../../../shared/i18n'

export interface CatalogGroup<T> {
  id: string
  label: UiMessage
  rows: T[]
}

// 행이 하나도 없는 그룹은 반환하지 않는다.
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

// provider = 관계(kind)별. 순서는 사용자가 마주치는 순서 — 앱 로그인이 먼저 걸리고, 그 다음
// 모델, 마지막이 사내 서비스다(0181).
export function providerGroups(providers: ProviderInfo[]): CatalogGroup<ProviderInfo>[] {
  return nonEmpty([
    {
      id: 'gate',
      label: { key: 'skills.groups.gateProviders' },
      rows: providers.filter((provider) => provider.kind === 'gate')
    },
    {
      id: 'llm',
      label: { key: 'skills.groups.llmProviders' },
      rows: providers.filter((provider) => provider.kind === 'llm')
    },
    {
      id: 'service',
      label: { key: 'skills.groups.serviceProviders' },
      rows: providers.filter((provider) => provider.kind === 'service')
    }
  ])
}
