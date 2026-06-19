import { existsSync, cpSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { Backend } from '../../shared/ipc'
import { distDir } from '../config/paths'

export function syncWorkspaceExtensions(engine: Backend, cwd: string): void {
  const dist = distDir(engine)
  const skillsSrc = join(dist, '.claude', 'skills')
  const skillsDest = join(cwd, '.claude', 'skills')
  const mcpSrc = join(dist, '.mcp.json')
  const mcpDest = join(cwd, '.mcp.json')

  mkdirSync(cwd, { recursive: true })
  rmSync(skillsDest, { recursive: true, force: true })
  if (existsSync(skillsSrc)) cpSync(skillsSrc, skillsDest, { recursive: true, force: true })
  else mkdirSync(skillsDest, { recursive: true })
  if (existsSync(mcpSrc)) cpSync(mcpSrc, mcpDest, { force: true })
  else rmSync(mcpDest, { force: true })
}
