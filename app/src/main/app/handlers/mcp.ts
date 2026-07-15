// mcp 도메인 핸들러 — list / add / update / delete. add/update 의 검증·영속은 McpStore 내부
// zod 가 담당(handlePlain), delete 만 여기서 id 검증.

import { CHANNELS, DeleteMcpServerSchema, type McpServer } from '../../../shared/protocol'
import type { RouterContext } from '../context'
import { handle, handlePlain } from '../../infra/ipc/handle'

export function registerMcpHandlers(ctx: RouterContext): void {
  handlePlain(CHANNELS.mcpList, (): McpServer[] => ctx.mcp.list())

  handlePlain(CHANNELS.mcpAdd, async (raw): Promise<McpServer> => {
    const result = ctx.mcp.add(raw)
    await ctx.deployExtensions()
    return result
  })

  handlePlain(CHANNELS.mcpUpdate, async (raw): Promise<McpServer | null> => {
    const result = ctx.mcp.update(raw)
    await ctx.deployExtensions()
    return result
  })

  handle(CHANNELS.mcpDelete, DeleteMcpServerSchema, 'reject', async (req): Promise<void> => {
    ctx.mcp.remove(req.id)
    await ctx.deployExtensions()
  })
}
