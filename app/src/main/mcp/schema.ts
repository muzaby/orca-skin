// MCP 정규 소스 스키마 + 백엔드별 타깃 타입.
//
// 명명 규칙(중요): Orca 는 **claude 의 mcpServers 스펙을 정규형으로 채택**한다. 따라서
// 정규 컬렉션 타입을 `OrcaMcpConfig` 로 선언하고, Claude 형식은 이와 **동일하므로 별칭**으로
// 못박는다 → `type ClaudeMcpConfig = OrcaMcpConfig`. (코드/문서에서 "IR(중간형)" 표현은 쓰지
// 않는다 — 정규형이 곧 claude 스펙이다.)
//
// 정규 소스는 **미확장**(${VAR} 플레이스홀더 보유). 확장은 convert.ts 의 변환기가 담당하며,
// Orca→Claude 는 동형이라 ${VAR} 확장만, Orca→Opencode 는 구조 변환까지 한다.

import { z } from 'zod'

// 단일 서버 항목 = Claude mcpServers 스키마 (claude 스펙). ${VAR} 미확장.
// http/sse 는 분리된 판별(discriminated) 멤버로 둔다 — SDK McpServerConfig 유니온
// (McpStdioServerConfig | McpHttpServerConfig | McpSSEServerConfig)에 그대로 대입되도록.
export const ClaudeMcpSchema = z.union([
  z.object({
    type: z.literal('stdio').optional(),
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional()
  }),
  z.object({
    type: z.literal('http'),
    url: z.string(),
    headers: z.record(z.string(), z.string()).optional()
  }),
  z.object({
    type: z.literal('sse'),
    url: z.string(),
    headers: z.record(z.string(), z.string()).optional()
  })
])

export type ClaudeMcp = z.infer<typeof ClaudeMcpSchema>

// Orca 정규 소스 컬렉션 (claude 스펙을 정규형으로 채택) = mcp.json 의 mcpServers 그대로.
export const OrcaMcpConfigSchema = z.record(z.string(), ClaudeMcpSchema)
export type OrcaMcpConfig = z.infer<typeof OrcaMcpConfigSchema>

// Orca 정규형 == Claude 형식. Orca 가 claude 스펙을 정규형으로 채택했으므로 동일 타입(별칭).
// 어댑터 레이어로 넘어가는 값은 이 이름(ClaudeMcpConfig)으로 다룬다(§convert / claude-adapt).
export type ClaudeMcpConfig = OrcaMcpConfig
