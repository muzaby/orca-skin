// 레거시 orca-mcp(electron-store, 풍부한 per-server 레코드 + authEnc) → 파일-백드 모델로 1회 이전.
//   mcp.json(정규 소스) + secret-store(비밀) + settings(mcpEnabled/mcpMeta)
// 멱등: mcp.json 이 이미 있으면 skip. 레거시 손상/safeStorage 잠김은 warn 후 계속(부팅 차단 금지).
// 레거시 스토어는 한 릴리스 동안 보존(롤백 안전망) — 여기서 지우지 않는다.

import Store from 'electron-store'
import { z } from 'zod'
import type { SettingsStore } from '../settings/store'
import { mcpFileExists, writeMcpFile } from '../config/mcp-file'
import { SecretStore } from '../config/secret-store'
import { safeDecrypt } from './crypto'
import type { ClaudeMcp, OrcaMcpConfig } from './schema'

const LegacyRecordSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  transport: z.enum(['stdio', 'http']),
  enabled: z.boolean().default(true),
  command: z.string().nullable().default(null),
  args: z.array(z.string()).default([]),
  authEnvKey: z.string().nullable().default(null),
  url: z.string().nullable().default(null),
  authEnc: z.string().nullable().default(null)
})
const LegacyStateSchema = z.object({ servers: z.array(LegacyRecordSchema).default([]) })

function synthVar(name: string): string {
  return `ORCA_MCP_${name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_AUTH`
}

export function migrateMcpToFile(settings: SettingsStore): void {
  if (mcpFileExists()) return

  const legacy = new Store<Record<string, unknown>>({ name: 'orca-mcp', defaults: { servers: [] } })
  const parsed = LegacyStateSchema.safeParse(legacy.store)
  if (!parsed.success || parsed.data.servers.length === 0) return

  const secrets = new SecretStore()
  const servers: OrcaMcpConfig = {}
  const mcpEnabled: Record<string, boolean> = {}
  const mcpMeta: Record<string, { description: string }> = {}

  for (const r of parsed.data.servers) {
    const plain = r.authEnc ? safeDecrypt(r.authEnc) : null
    if (r.authEnc && plain === null) {
      // safeStorage 잠김/다른 사용자 — 비밀 복원 실패. 평문/빈 플레이스홀더 금지: 비밀 없이 이전.
      console.warn(
        `[mcp:migrate] '${r.name}' 의 인증값을 복호화하지 못해 비밀 없이 이전합니다(재입력 필요).`
      )
    }
    const authVar = plain
      ? r.authEnvKey && r.authEnvKey.trim() !== ''
        ? r.authEnvKey.trim()
        : synthVar(r.name)
      : null
    if (authVar && plain) secrets.set(authVar, plain)

    let source: ClaudeMcp
    if (r.transport === 'http') {
      const headers = authVar ? { Authorization: `Bearer \${${authVar}}` } : undefined
      source = { type: 'http', url: r.url ?? '', ...(headers ? { headers } : {}) }
    } else {
      const env = authVar ? { [authVar]: `\${${authVar}}` } : undefined
      source = {
        command: r.command ?? '',
        ...(r.args.length > 0 ? { args: r.args } : {}),
        ...(env ? { env } : {})
      }
    }
    servers[r.name] = source
    mcpEnabled[r.name] = r.enabled
    mcpMeta[r.name] = { description: r.description }
  }

  writeMcpFile({ mcpServers: servers })
  const s = settings.getAll()
  settings.patch({
    mcpEnabled: { ...s.mcpEnabled, ...mcpEnabled },
    mcpMeta: { ...s.mcpMeta, ...mcpMeta }
  })
  console.warn(
    `[mcp:migrate] 레거시 MCP 서버 ${parsed.data.servers.length}개를 mcp.json 으로 이전했습니다.`
  )
}
