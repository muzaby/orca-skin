// project 도메인 핸들러 — list / create / update / delete / listSessions.
// 순수 DB CRUD. 쓰기류는 'reject' 정책(무효 페이로드 = 프로그래머 오류 표면화).

import { randomUUID } from 'node:crypto'
import {
  CHANNELS,
  CreateProjectSchema,
  DeleteProjectSchema,
  ListProjectSessionsSchema,
  SetProjectPinnedSchema,
  UpdateProjectSchema,
  type Project,
  type SessionListItem
} from '../../../shared/protocol'
import type { RouterContext } from '../context'
import { toProject, toSessionListItem } from '../../infra/ipc/dto'
import { handle, handlePlain } from '../../infra/ipc/handle'

export function registerProjectHandlers(ctx: RouterContext): void {
  handlePlain(CHANNELS.projectList, (): Project[] => ctx.db.listProjects().map(toProject))

  handle(CHANNELS.projectCreate, CreateProjectSchema, 'reject', (req): Project => {
    const id = randomUUID()
    const now = Date.now()
    ctx.db.insertProject({
      id,
      name: req.name,
      instructions: req.instructions,
      createdAt: now
    })
    return {
      id,
      name: req.name,
      instructions: req.instructions,
      createdAt: now,
      updatedAt: now,
      pinnedAt: null
    }
  })

  handle(CHANNELS.projectUpdate, UpdateProjectSchema, 'reject', (req): void => {
    ctx.db.updateProject(req.id, { name: req.name, instructions: req.instructions }, Date.now())
  })

  handle(CHANNELS.projectDelete, DeleteProjectSchema, 'reject', (req): void => {
    // ON DELETE SET NULL 이 sessions.project_id 를 정리. 세션 자체는 보존.
    ctx.db.deleteProject(req.id)
  })

  // 0129 고정 토글 — pinned=true 면 현재 시각(정렬 키 겸용), false 면 null.
  handle(CHANNELS.projectSetPinned, SetProjectPinnedSchema, 'reject', (req): void => {
    ctx.db.setProjectPinned(req.id, req.pinned ? Date.now() : null)
  })

  handle(
    CHANNELS.projectListSessions,
    ListProjectSessionsSchema,
    'reject',
    (req): SessionListItem[] => ctx.db.listSessionsByProject(req.projectId).map(toSessionListItem)
  )
}
