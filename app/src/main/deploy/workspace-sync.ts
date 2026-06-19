import { existsSync, cpSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Backend } from '../../shared/ipc'
import { distDir } from '../config/paths'

// dist 의 스킬/mcp 거울을 cwd 로 **overwrite-merge** 한다 (replace 아님 — 와이프하지 않는다).
// cwd 의 비-Orca 사용자 파일은 보존되고, dist 와 동일명 항목만 덮어쓴다. 활성/비활성 제어는
// 런타임 options.skills 필터가 담당하므로 비활성 스킬을 cwd 에서 삭제하지 않아도 무방하다.
// 호출 빈도는 router 가 cwd 단위로 게이팅한다(세션 첫 턴 1회 — syncedCwds).
export function syncWorkspaceExtensions(engine: Backend, cwd: string): void {
  const dist = distDir(engine)
  const skillsSrc = join(dist, '.claude', 'skills')
  const skillsDest = join(cwd, '.claude', 'skills')
  const mcpSrc = join(dist, '.mcp.json')
  const mcpDest = join(cwd, '.mcp.json')

  mkdirSync(skillsDest, { recursive: true })
  if (existsSync(skillsSrc)) cpSync(skillsSrc, skillsDest, { recursive: true, force: true })
  if (existsSync(mcpSrc)) cpSync(mcpSrc, mcpDest, { force: true })
}
