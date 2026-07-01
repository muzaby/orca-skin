// mcp 도메인 핸들러 — list / add / update / delete. add/update 의 검증·영속은 McpStore 내부
// zod 가 담당(handlePlain), delete 만 여기서 id 검증.

import { CHANNELS, DeleteMcpServerSchema, type McpServer } from '../../../shared/protocol'
import type { RouterContext } from '../context'
import { handle, handlePlain } from '../registry'

export function registerMcpHandlers(ctx: RouterContext): void {
  handlePlain(CHANNELS.mcpList, (): McpServer[] => ctx.mcp.list())

  handlePlain(CHANNELS.mcpAdd, (raw): McpServer => {
    const result = ctx.mcp.add(raw)
    ctx.deployExtensions()
    return result
  })

  handlePlain(CHANNELS.mcpUpdate, (raw): McpServer | null => {
    const result = ctx.mcp.update(raw)
    ctx.deployExtensions()
    return result
  })

  handle(CHANNELS.mcpDelete, DeleteMcpServerSchema, 'reject', (req): void => {
    ctx.mcp.remove(req.id)
    ctx.deployExtensions()
  })
}
