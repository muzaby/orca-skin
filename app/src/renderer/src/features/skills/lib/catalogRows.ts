import type { McpServer, SkillInfo } from '../../../../../shared/ipc'
import type { MessageKey } from '../../../shared/i18n'

export function skillRowMeta(skill: SkillInfo): { updatedAtMs: number | null; author: string } {
  return {
    updatedAtMs: skill.updatedAt ?? null,
    author: skill.sourceKind === 'orca' ? 'skills.table.user' : skill.sourceLabel
  }
}

export function mcpRowMeta(server: McpServer): {
  statusKey: MessageKey
  transport: McpServer['transport']
} {
  return {
    statusKey: server.enabled ? 'skills.mcpDetail.active' : 'skills.mcpDetail.inactive',
    transport: server.transport
  }
}
