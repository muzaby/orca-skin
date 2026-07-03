// mcp.json 읽기/쓰기. 파일은 **정규 소스**(미확장 ${VAR} 플레이스홀더만, 평문 비밀 0) 다.
// 손상/부재 시 빈 컬렉션으로 복원해 부팅을 막지 않는다. 쓰기는 atomic(temp+rename).

import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { mcpJsonPath } from './paths'
import { writeJsonAtomic } from './json-file'
import { OrcaMcpConfigSchema, type OrcaMcpConfig } from '../../mcp/schema'

const McpFileSchema = z.object({
  mcpServers: OrcaMcpConfigSchema.default({})
})
export type McpFile = z.infer<typeof McpFileSchema>

export function readMcpFile(): McpFile {
  let raw: string
  try {
    raw = readFileSync(mcpJsonPath(), 'utf8')
  } catch {
    return { mcpServers: {} }
  }
  try {
    const parsed = McpFileSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : { mcpServers: {} }
  } catch {
    return { mcpServers: {} }
  }
}

// 미확장 소스만 받는다(타입으로 강제). 확장된 비밀값이 파일로 새어나가지 않게 호출부에서 보장.
export function writeMcpFile(file: { mcpServers: OrcaMcpConfig }): void {
  writeJsonAtomic(mcpJsonPath(), file)
}

export function mcpFileExists(): boolean {
  try {
    readFileSync(mcpJsonPath(), 'utf8')
    return true
  } catch {
    return false
  }
}
