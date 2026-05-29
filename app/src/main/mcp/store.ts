// 전역 MCP 서버 관리. 3개 출처를 조율한다:
//   ① mcp.json (~/.config/orca) — 정규 소스(순정 Claude mcpServers 스키마 + ${VAR} 플레이스홀더)
//   ② secret-store (<userData>, safeStorage) — 비밀. env-var 이름으로 키잉.
//   ③ settings (electron-store) — enabled on/off(mcpEnabled) + Orca 전용 메타(mcpMeta.description)
//
// renderer 로 나가는 DTO(McpServer)는 id/transport/description 등 Orca 관점 필드를 갖는다.
// 정규 소스엔 id/description 이 없으므로 id = name(고유 키)으로 두고, description 은 settings 에서
// 합성한다. 비밀 평문은 절대 mcp.json·DTO 에 들어가지 않는다(hasAuth boolean 만 노출).

import {
  CreateMcpServerSchema,
  UpdateMcpServerSchema,
  type CreateMcpServerRequest,
  type McpServer,
  type UpdateMcpServerRequest
} from '../../shared/protocol'
import type { SettingsStore } from '../settings/store'
import type { McpQueryOptions } from '../adapters/types'
import { readMcpFile, writeMcpFile } from '../config/mcp-file'
import { SecretStore } from '../config/secret-store'
import { toClaudecodeConfig } from './convert'
import { makeResolver } from './resolver'
import type { ClaudeMcp, OrcaMcpServers } from './schema'

const VAR_RE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g

// 소스 항목이 참조하는 첫 ${VAR} 이름 = "인증 env-var". app 이 만든 서버는 정확히 하나.
// 손으로 편집한 다변수 서버는 첫 변수를 best-effort 로 노출(DTO 는 표시/편집용).
function authVarOf(server: ClaudeMcp): string | null {
  const haystack =
    'url' in server ? Object.values(server.headers ?? {}) : Object.values(server.env ?? {})
  for (const v of haystack) {
    const re = new RegExp(VAR_RE.source)
    const m = re.exec(v)
    if (m) return m[1]
  }
  return null
}

// authEnvKey 미지정 + 비밀만 있을 때 합성하는 env-var 이름.
function synthVar(name: string): string {
  return `ORCA_MCP_${name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}_AUTH`
}

export class McpStore {
  private readonly secrets = new SecretStore()

  constructor(private readonly settings: SettingsStore) {}

  private read(): OrcaMcpServers {
    return readMcpFile().mcpServers
  }

  private write(servers: OrcaMcpServers): void {
    writeMcpFile({ mcpServers: servers })
  }

  private toDto(name: string, server: ClaudeMcp): McpServer {
    const isHttp = 'url' in server
    const authEnvKey = authVarOf(server)
    const s = this.settings.getAll()
    return {
      id: name,
      name,
      description: s.mcpMeta[name]?.description ?? '',
      transport: isHttp ? 'http' : 'stdio',
      enabled: s.mcpEnabled[name] ?? true,
      command: isHttp ? null : (server.command ?? null),
      args: isHttp ? [] : (server.args ?? []),
      authEnvKey,
      url: isHttp ? server.url : null,
      hasAuth: authEnvKey != null && this.secrets.has(authEnvKey)
    }
  }

  list(): McpServer[] {
    const servers = this.read()
    return Object.entries(servers).map(([name, server]) => this.toDto(name, server))
  }

  // 정규 소스 항목 + 비밀 사이드 이펙트를 함께 구성한다.
  // auth 평문이 주어지면 secret-store 에 env-var 이름으로 저장하고 소스엔 ${VAR} 만 남긴다.
  private buildSource(
    name: string,
    transport: 'stdio' | 'http',
    fields: {
      command?: string | null
      args?: string[]
      url?: string | null
      authEnvKey?: string | null
    },
    auth: string | undefined,
    prevAuthVar: string | null
  ): ClaudeMcp {
    // 인증 env-var 이름 결정: 명시 authEnvKey → 기존 var → (비밀 있으면) 합성.
    const explicit =
      fields.authEnvKey && fields.authEnvKey.trim() !== '' ? fields.authEnvKey.trim() : null
    const hasSecretNow =
      auth !== undefined ? auth !== '' : prevAuthVar != null && this.secrets.has(prevAuthVar)
    const authVar = explicit ?? prevAuthVar ?? (hasSecretNow ? synthVar(name) : null)

    // auth 미변경인데 env-var 이름이 바뀌면 기존 비밀을 새 이름으로 옮긴다(고아 방지).
    if (
      auth === undefined &&
      prevAuthVar &&
      authVar &&
      authVar !== prevAuthVar &&
      this.secrets.has(prevAuthVar)
    ) {
      const moved = this.secrets.get(prevAuthVar)
      if (moved !== undefined) this.secrets.set(authVar, moved)
      this.deleteSecretIfUnused(prevAuthVar, name)
    }

    // 비밀 적용: auth undefined → 미변경. '' → 제거. 그 외 → 저장.
    if (auth !== undefined && authVar) {
      if (auth === '') this.deleteSecretIfUnused(authVar, name)
      else this.secrets.set(authVar, auth)
    }

    const placeholder = authVar && hasSecretNow

    if (transport === 'http') {
      const headers = placeholder ? { Authorization: `Bearer \${${authVar}}` } : undefined
      return { type: 'http', url: (fields.url ?? '').trim(), ...(headers ? { headers } : {}) }
    }
    const env = placeholder ? { [authVar]: `\${${authVar}}` } : undefined
    return {
      command: (fields.command ?? '').trim(),
      ...(fields.args && fields.args.length > 0 ? { args: fields.args } : {}),
      ...(env ? { env } : {})
    }
  }

  add(input: unknown): McpServer {
    const data: CreateMcpServerRequest = CreateMcpServerSchema.parse(input)
    const servers = this.read()
    if (servers[data.name]) {
      throw new Error(`이미 존재하는 MCP 서버 이름입니다: ${data.name}`)
    }
    const source = this.buildSource(
      data.name,
      data.transport,
      { command: data.command, args: data.args, url: data.url, authEnvKey: data.authEnvKey },
      data.auth,
      null
    )
    servers[data.name] = source
    this.write(servers)
    const s = this.settings.getAll()
    this.settings.patch({
      mcpEnabled: { ...s.mcpEnabled, [data.name]: data.enabled ?? true },
      mcpMeta: { ...s.mcpMeta, [data.name]: { description: data.description ?? '' } }
    })
    return this.toDto(data.name, source)
  }

  update(input: unknown): McpServer | null {
    const data: UpdateMcpServerRequest = UpdateMcpServerSchema.parse(input)
    const servers = this.read()
    const prevName = data.id
    const prev = servers[prevName]
    if (!prev) return null

    const nextName = data.name ?? prevName
    if (nextName !== prevName && servers[nextName]) {
      throw new Error(`이미 존재하는 MCP 서버 이름입니다: ${nextName}`)
    }

    const transport: 'stdio' | 'http' = data.transport ?? ('url' in prev ? 'http' : 'stdio')
    const prevAuthVar = authVarOf(prev)
    const prevCmd = 'url' in prev ? null : prev.command
    const prevArgs = 'url' in prev ? [] : (prev.args ?? [])
    const prevUrl = 'url' in prev ? prev.url : null

    const source = this.buildSource(
      nextName,
      transport,
      {
        command: data.command ?? prevCmd,
        args: data.args ?? prevArgs,
        url: data.url ?? prevUrl,
        authEnvKey: data.authEnvKey ?? prevAuthVar
      },
      data.auth,
      prevAuthVar
    )

    // rekey on rename.
    if (nextName !== prevName) delete servers[prevName]
    servers[nextName] = source
    this.write(servers)

    // settings 메타 이전.
    const s = this.settings.getAll()
    const enabled = { ...s.mcpEnabled }
    const meta = { ...s.mcpMeta }
    const wasEnabled = enabled[prevName] ?? true
    const prevDesc = meta[prevName]?.description ?? ''
    if (nextName !== prevName) {
      delete enabled[prevName]
      delete meta[prevName]
    }
    enabled[nextName] = data.enabled ?? wasEnabled
    meta[nextName] = { description: data.description ?? prevDesc }
    this.settings.patch({ mcpEnabled: enabled, mcpMeta: meta })

    return this.toDto(nextName, source)
  }

  remove(id: string): void {
    const servers = this.read()
    const target = servers[id]
    if (!target) return
    const authVar = authVarOf(target)
    delete servers[id]
    this.write(servers)
    if (authVar) this.deleteSecretIfUnused(authVar, id)
    const s = this.settings.getAll()
    const enabled = { ...s.mcpEnabled }
    const meta = { ...s.mcpMeta }
    delete enabled[id]
    delete meta[id]
    this.settings.patch({ mcpEnabled: enabled, mcpMeta: meta })
  }

  // 같은 env-var 를 다른 서버가 참조하지 않을 때만 비밀을 삭제(공유 토큰 보호).
  private deleteSecretIfUnused(authVar: string, excludeName: string): void {
    const servers = this.read()
    const stillUsed = Object.entries(servers).some(
      ([n, srv]) => n !== excludeName && authVarOf(srv) === authVar
    )
    if (!stillUsed) this.secrets.delete(authVar)
  }

  // 활성화된 서버를 SDK query 옵션으로 변환. 비밀은 resolver 안에서만 잠깐 복호화된다.
  // 미해결 ${VAR} 로 드롭된 서버는 console.warn 으로 기록(조용히 삼키지 않는다).
  buildQueryOptions(): McpQueryOptions {
    const s = this.settings.getAll()
    const all = this.read()
    const enabledServers: OrcaMcpServers = {}
    for (const [name, server] of Object.entries(all)) {
      if ((s.mcpEnabled[name] ?? true) === true) enabledServers[name] = server
    }
    const { config, dropped } = toClaudecodeConfig(enabledServers, makeResolver(this.secrets))
    for (const d of dropped) {
      console.warn(`[mcp] 서버 '${d.name}' 를 건너뜀: ${d.reason}`)
    }
    return {
      servers: config,
      allowedTools: Object.keys(config).map((n) => `mcp__${n}__*`)
    }
  }
}
