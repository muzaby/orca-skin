// project 도메인 핸들러 — list / create / update / delete / listSessions.
// 순수 DB CRUD. 검증은 구 router 와 동형(.parse — 무효 입력은 invoke reject).

import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { randomUUID } from 'node:crypto'
import {
  CHANNELS,
  CreateProjectSchema,
  DeleteProjectSchema,
  ListProjectSessionsSchema,
  UpdateProjectSchema,
  type Project,
  type SessionListItem
} from '../../../shared/protocol'
import type { RouterContext } from '../context'
import { toProject, toSessionListItem } from '../dto'

export function registerProjectHandlers(ctx: RouterContext): void {
  ipcMain.handle(
    CHANNELS.projectList,
    async (): Promise<Project[]> => ctx.db.listProjects().map(toProject)
  )

  ipcMain.handle(
    CHANNELS.projectCreate,
    async (_event: IpcMainInvokeEvent, raw: unknown): Promise<Project> => {
      const parsed = CreateProjectSchema.parse(raw)
      const id = randomUUID()
      const now = Date.now()
      ctx.db.insertProject({
        id,
        name: parsed.name,
        instructions: parsed.instructions,
        createdAt: now
      })
      return {
        id,
        name: parsed.name,
        instructions: parsed.instructions,
        createdAt: now,
        updatedAt: now
      }
    }
  )

  ipcMain.handle(
    CHANNELS.projectUpdate,
    async (_event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
      const parsed = UpdateProjectSchema.parse(raw)
      ctx.db.updateProject(
        parsed.id,
        { name: parsed.name, instructions: parsed.instructions },
        Date.now()
      )
    }
  )

  ipcMain.handle(
    CHANNELS.projectDelete,
    async (_event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
      const parsed = DeleteProjectSchema.parse(raw)
      // ON DELETE SET NULL 이 sessions.project_id 를 정리. 세션 자체는 보존.
      ctx.db.deleteProject(parsed.id)
    }
  )

  ipcMain.handle(
    CHANNELS.projectListSessions,
    async (_event: IpcMainInvokeEvent, raw: unknown): Promise<SessionListItem[]> => {
      const parsed = ListProjectSessionsSchema.parse(raw)
      return ctx.db.listSessionsByProject(parsed.projectId).map(toSessionListItem)
    }
  )
}
