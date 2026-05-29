// MCP 정규 소스 스키마 + 백엔드별 타깃 타입.
//
// 명명 규칙(중요): 환경구성 **표준 = Claude `mcpServers` 스키마**이므로 단일 서버 항목의
// 기준 타입을 `ClaudeMcp` 로 정의한다. Orca 의 정규 소스 컬렉션은 `Orca` 프리픽스로 명명하되
// 그 항목이 곧 `ClaudeMcp` 임을 타입으로 못박는다 → `OrcaMcpServers = Record<string, ClaudeMcp>`.
// (코드/문서에서 "IR(중간형)" 표현은 쓰지 않는다 — 소스가 곧 Claude 스키마다.)
//
// 정규 소스는 **미확장**(${VAR} 플레이스홀더 보유). 확장·셰이핑은 convert.ts 의 변환기가 담당.

import { z } from 'zod'
import type { McpServerConfig } from '../adapters/types'

// 단일 서버 항목 = Claude mcpServers 스키마 (${VAR} 미확장). stdio | http | sse.
export const ClaudeMcpSchema = z.union([
  z.object({
    type: z.literal('stdio').optional(),
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional()
  }),
  z.object({
    type: z.union([z.literal('http'), z.literal('sse')]),
    url: z.string(),
    headers: z.record(z.string(), z.string()).optional()
  })
])

export type ClaudeMcp = z.infer<typeof ClaudeMcpSchema>

// Orca 정규 소스 컬렉션 = Claude 항목들의 맵 (= mcp.json 의 mcpServers 그대로).
export const OrcaMcpServersSchema = z.record(z.string(), ClaudeMcpSchema)
export type OrcaMcpServers = z.infer<typeof OrcaMcpServersSchema>

// --- opencode 타깃: 항목 + 컬렉션 (백엔드-프리픽스) ---
export type OpencodeMcp =
  | { type: 'local'; command: string[]; environment?: Record<string, string>; enabled: boolean }
  | { type: 'remote'; url: string; headers?: Record<string, string>; enabled: boolean }
export type OpencodeMcpConfig = Record<string, OpencodeMcp>

// --- claude-code 타깃: 항목 + 컬렉션 (opencode 와 완전 동형 — Record<string, 항목>) ---
// 항목 형은 SDK 주입 타깃(McpServerConfig, ${VAR} 확장 완료, sse→http 정규화 완료).
export type ClaudecodeMcp = McpServerConfig
export type ClaudecodeMcpConfig = Record<string, ClaudecodeMcp>
