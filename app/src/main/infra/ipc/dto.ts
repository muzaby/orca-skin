// IPC 응답 DTO 변환 — DB row → 와이어 타입. 핸들러 도메인 모듈들이 공유하는 순수 함수만 둔다.

import type { AppMessagePart, Project, SessionListItem } from '../../../shared/protocol'
import type { LoadedPartRow, ProjectRow, SessionListRow } from '../db/types'

export function previewOf(text: string, max = 80): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > max ? collapsed.slice(0, max) : collapsed
}

export function toSessionListItem(r: SessionListRow): SessionListItem {
  return {
    id: r.id,
    backend: r.backend,
    title: r.title,
    updatedAt: r.updated_at,
    preview: r.last_message_preview,
    projectId: r.project_id,
    cwd: r.cwd,
    pinnedAt: r.pinned_at
  }
}

export function toProject(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name,
    instructions: r.instructions,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    pinnedAt: r.pinned_at
  }
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}

// message_parts 한 행 → AppMessagePart. payload_json 은 type 외 필드의 JSON 이고, tool_*
// 의 toolRunId 는 별도 컬럼이라 재부착한다. payload 는 우리가 쓴 것이라 shape 가 보장된다.
export function partFromRow(r: LoadedPartRow): AppMessagePart {
  const payload = safeJsonParse(r.payload_json)
  const base = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<
    string,
    unknown
  >
  const part: Record<string, unknown> = { type: r.type, ...base }
  if (r.tool_run_id != null) part.toolRunId = r.tool_run_id
  return part as unknown as AppMessagePart
}
