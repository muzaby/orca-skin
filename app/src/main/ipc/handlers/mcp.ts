// mcp 도메인 핸들러 — list / add / update / delete. 검증·영속은 McpStore 가 담당
// (add/update 는 스토어 내부 zod, delete 만 여기서 id 검증 — 구 router 와 동형).

import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { CHANNELS, DeleteMcpServerSchema, type McpServer } from '../../../shared/protocol'
import type { RouterContext } from '../context'

export function registerMcpHandlers(ctx: RouterContext): void {
  ipcMain.handle(CHANNELS.mcpList, async (): Promise<McpServer[]> => ctx.mcp.list())

  ipcMain.handle(
    CHANNELS.mcpAdd,
    async (_event: IpcMainInvokeEvent, raw: unknown): Promise<McpServer> => ctx.mcp.add(raw)
  )

  ipcMain.handle(
    CHANNELS.mcpUpdate,
    async (_event: IpcMainInvokeEvent, raw: unknown): Promise<McpServer | null> =>
      ctx.mcp.update(raw)
  )

  ipcMain.handle(
    CHANNELS.mcpDelete,
    async (_event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
      const parsed = DeleteMcpServerSchema.parse(raw)
      ctx.mcp.remove(parsed.id)
    }
  )
}
