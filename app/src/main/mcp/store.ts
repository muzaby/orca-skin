// MCP 서버 설정 영속화 (전역). electron-store 단일 컬렉션 + zod 검증.
// 인증 비밀(auth)은 평문으로 디스크에 남기지 않는다 — Electron safeStorage(OS 키체인)로
// 암호화해 base64(authEnc) 로만 저장하고, renderer 에는 보유 여부(hasAuth)만 노출한다.
// (보안 베이스라인: app/CLAUDE.md "비밀 저장" + BACKEND_ARCHITECTURE safeStorage 모델)

import { randomUUID } from 'node:crypto'
import { safeStorage } from 'electron'
import Store from 'electron-store'
import { z } from 'zod'
import {
  CreateMcpServerSchema,
  UpdateMcpServerSchema,
  type CreateMcpServerRequest,
  type McpServer,
  type UpdateMcpServerRequest
} from '../../shared/protocol'
import type { McpQueryOptions, McpServerConfig } from '../adapters/types'

// 디스크 레코드 — DTO 와 달리 authEnc(암호문) · createdAt/updatedAt 포함.
const McpRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  transport: z.enum(['stdio', 'http']),
  enabled: z.boolean().default(true),
  command: z.string().nullable().default(null),
  args: z.array(z.string()).default([]),
  authEnvKey: z.string().nullable().default(null),
  url: z.string().nullable().default(null),
  authEnc: z.string().nullable().default(null),
  createdAt: z.number(),
  updatedAt: z.number()
})

type McpRecord = z.infer<typeof McpRecordSchema>

const StateSchema = z.object({ servers: z.array(McpRecordSchema).default([]) })
type State = z.infer<typeof StateSchema>
type Raw = Record<string, unknown>

function readSafe(raw: Raw): State {
  const parsed = StateSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  return { servers: [] }
}

function toDto(r: McpRecord): McpServer {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    transport: r.transport,
    enabled: r.enabled,
    command: r.command,
    args: r.args,
    authEnvKey: r.authEnvKey,
    url: r.url,
    hasAuth: r.authEnc != null
  }
}

function encrypt(plain: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage 암호화를 사용할 수 없어 인증값을 저장할 수 없습니다.')
  }
  return safeStorage.encryptString(plain).toString('base64')
}

function decrypt(b64: string): string {
  return safeStorage.decryptString(Buffer.from(b64, 'base64'))
}

export class McpStore {
  private readonly store = new Store<Raw>({
    name: 'orca-mcp',
    defaults: { servers: [] }
  })

  private read(): State {
    return readSafe(this.store.store)
  }

  private write(state: State): void {
    this.store.store = state as Raw
  }

  list(): McpServer[] {
    return this.read().servers.map(toDto)
  }

  add(input: unknown): McpServer {
    const data: CreateMcpServerRequest = CreateMcpServerSchema.parse(input)
    const state = this.read()
    if (state.servers.some((s) => s.name === data.name)) {
      throw new Error(`이미 존재하는 MCP 서버 이름입니다: ${data.name}`)
    }
    const now = Date.now()
    const record: McpRecord = {
      id: randomUUID(),
      name: data.name,
      description: data.description ?? '',
      transport: data.transport,
      enabled: data.enabled ?? true,
      command: data.transport === 'stdio' ? (data.command ?? null) : null,
      args: data.transport === 'stdio' ? (data.args ?? []) : [],
      authEnvKey: data.transport === 'stdio' ? (data.authEnvKey ?? null) : null,
      url: data.transport === 'http' ? (data.url ?? null) : null,
      authEnc: data.auth && data.auth !== '' ? encrypt(data.auth) : null,
      createdAt: now,
      updatedAt: now
    }
    this.write({ servers: [...state.servers, record] })
    return toDto(record)
  }

  update(input: unknown): McpServer | null {
    const data: UpdateMcpServerRequest = UpdateMcpServerSchema.parse(input)
    const state = this.read()
    const idx = state.servers.findIndex((s) => s.id === data.id)
    if (idx === -1) return null
    const prev = state.servers[idx]

    if (data.name && data.name !== prev.name) {
      if (state.servers.some((s) => s.name === data.name && s.id !== data.id)) {
        throw new Error(`이미 존재하는 MCP 서버 이름입니다: ${data.name}`)
      }
    }

    const transport = data.transport ?? prev.transport
    const next: McpRecord = {
      ...prev,
      name: data.name ?? prev.name,
      description: data.description ?? prev.description,
      transport,
      enabled: data.enabled ?? prev.enabled,
      command: transport === 'stdio' ? (data.command ?? prev.command) : null,
      args: transport === 'stdio' ? (data.args ?? prev.args) : [],
      authEnvKey: transport === 'stdio' ? (data.authEnvKey ?? prev.authEnvKey) : null,
      url: transport === 'http' ? (data.url ?? prev.url) : null,
      // auth undefined → 미변경(기존 유지). 빈 문자열 → 비밀 제거. 그 외 → 재암호화.
      authEnc:
        data.auth === undefined ? prev.authEnc : data.auth === '' ? null : encrypt(data.auth),
      updatedAt: Date.now()
    }
    const servers = [...state.servers]
    servers[idx] = next
    this.write({ servers })
    return toDto(next)
  }

  remove(id: string): void {
    const state = this.read()
    this.write({ servers: state.servers.filter((s) => s.id !== id) })
  }

  // 활성화된 서버를 SDK query 옵션으로 변환. 비밀은 이 시점에만 복호화해 메모리에 잠깐 머문다.
  buildQueryOptions(): McpQueryOptions {
    const servers: Record<string, McpServerConfig> = {}
    const allowedTools: string[] = []
    for (const r of this.read().servers) {
      if (!r.enabled) continue
      const auth = r.authEnc ? safeDecrypt(r.authEnc) : null
      if (r.transport === 'stdio') {
        if (!r.command) continue
        const env = r.authEnvKey && auth ? { [r.authEnvKey]: auth } : undefined
        servers[r.name] = {
          type: 'stdio',
          command: r.command,
          args: r.args,
          ...(env ? { env } : {})
        }
      } else {
        if (!r.url) continue
        const headers = auth ? { Authorization: `Bearer ${auth}` } : undefined
        servers[r.name] = { type: 'http', url: r.url, ...(headers ? { headers } : {}) }
      }
      allowedTools.push(`mcp__${r.name}__*`)
    }
    return { servers, allowedTools }
  }
}

// 복호화 실패(키체인 잠김·다른 사용자 등)는 해당 인증을 생략하고 서버는 계속 등록.
function safeDecrypt(b64: string): string | null {
  try {
    return decrypt(b64)
  } catch {
    return null
  }
}
