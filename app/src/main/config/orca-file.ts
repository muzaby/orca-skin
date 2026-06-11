// orca.json 읽기/생성. 파일은 앱 전역 agent/provider 설정의 정규 소스다.
// 부재 시 사용자가 발견·편집할 수 있게 빈 템플릿을 atomic(temp+rename) 생성한다.
// 손상 파일은 절대 덮어쓰지 않고 기본값으로만 동작한다.

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import { orcaJsonPath } from './paths'
import { dedupeAgents } from './provider-key'

export const OrcaModelSchema = z.object({
  name: z.string().min(1),
  family: z.string().optional(),
  default: z.boolean().optional()
})
export type OrcaModelConfig = z.infer<typeof OrcaModelSchema>

export const OrcaAgentSchema = z.object({
  adapter: z.string().min(1),
  provider: z.string().optional(),
  authToken: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  models: z.array(OrcaModelSchema).default([])
})
export type OrcaAgentConfig = z.infer<typeof OrcaAgentSchema>

const OrcaConfigTopSchema = z.object({
  version: z.literal(1),
  agents: z.array(z.unknown())
})

export interface OrcaConfig {
  version: 1
  agents: OrcaAgentConfig[]
}

export interface ParseOrcaFileResult {
  config: OrcaConfig
  warnings: string[]
}

const DEFAULT_ORCA_CONFIG: OrcaConfig = { version: 1, agents: [] }

function issueSummary(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ')
}

export function parseOrcaFile(raw: string): ParseOrcaFileResult {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch (err) {
    return {
      config: DEFAULT_ORCA_CONFIG,
      warnings: [`orca.json JSON 파싱 실패 — 기본값 사용: ${String(err)}`]
    }
  }

  const top = OrcaConfigTopSchema.safeParse(json)
  if (!top.success) {
    return {
      config: DEFAULT_ORCA_CONFIG,
      warnings: [`orca.json 최상위 스키마 위반 — 기본값 사용: ${issueSummary(top.error)}`]
    }
  }

  const agents: OrcaAgentConfig[] = []
  const warnings: string[] = []
  for (const [index, candidate] of top.data.agents.entries()) {
    const parsed = OrcaAgentSchema.safeParse(candidate)
    if (parsed.success) {
      const { apiKey, authToken, ...rest } = parsed.data
      if (apiKey !== undefined)
        warnings.push(`orca.json agents[${index}] apiKey 는 deprecated — authToken 사용 권장`)
      agents.push({ ...rest, ...((authToken ?? apiKey) ? { authToken: authToken ?? apiKey } : {}) })
    } else {
      warnings.push(`orca.json agents[${index}] 드롭: ${issueSummary(parsed.error)}`)
    }
  }
  const deduped = dedupeAgents(agents, (warning) => warnings.push(`orca.json ${warning}`))
  return { config: { version: 1, agents: deduped }, warnings }
}

export function ensureOrcaFile(): void {
  const path = orcaJsonPath()
  if (existsSync(path)) return
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(DEFAULT_ORCA_CONFIG, null, 2), 'utf8')
  renameSync(tmp, path)
}

export function readOrcaFile(): ParseOrcaFileResult {
  let raw: string
  try {
    raw = readFileSync(orcaJsonPath(), 'utf8')
  } catch (err) {
    return {
      config: DEFAULT_ORCA_CONFIG,
      warnings: [`orca.json 읽기 실패 — 기본값 사용: ${String(err)}`]
    }
  }
  return parseOrcaFile(raw)
}
