import { describe, expect, it } from 'vitest'
import type { McpServer, SkillInfo } from '../../../../../shared/ipc'
import { mcpRowMeta, skillRowMeta } from './catalogRows'
const skill = { sourceKind: 'orca', sourceId: 'orca', sourceLabel: 'Orca', name: 'x' } as SkillInfo
describe('catalog rows', () => {
  it('updatedAt 미지정 스킬은 updatedAtMs 가 null 이다', () =>
    expect(skillRowMeta(skill).updatedAtMs).toBeNull())
  it('updatedAt 지정 스킬은 값을 보존한다', () =>
    expect(skillRowMeta({ ...skill, updatedAt: 42 }).updatedAtMs).toBe(42))
  it('MCP 행 메타는 enabled 로 상태 키를 가른다', () => {
    expect(mcpRowMeta({ enabled: true, transport: 'http' } as McpServer)).toEqual({
      statusKey: 'skills.mcpDetail.active',
      transport: 'http'
    })
    expect(mcpRowMeta({ enabled: false, transport: 'stdio' } as McpServer).statusKey).toBe(
      'skills.mcpDetail.inactive'
    )
  })
})
