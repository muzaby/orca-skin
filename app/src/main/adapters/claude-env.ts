// orca.json agent 설정을 claude-code SDK subprocess env 로 변환한다.
// CLAUDE_CODE_* / ANTHROPIC_* 어휘는 어댑터 경계 안에만 둔다.

import type { OrcaAgentConfig } from '../config/orca-file'
import { expandVars, type Resolver } from '../mcp/expand'

export interface ClaudeEnvResult {
  env: Record<string, string>
  missing: string[]
}

function present(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : value
}

function setExpanded(
  out: Record<string, string>,
  key: string,
  value: string | undefined,
  resolve: Resolver,
  missing: Set<string>
): void {
  const source = present(value)
  if (source === undefined) return
  delete out[key]
  const before = new Set(missing)
  const expanded = expandVars(source, resolve, missing)
  const unresolved = [...missing].some((name) => !before.has(name))
  if (!unresolved) out[key] = expanded
}

export function toClaudeEnv(
  agent: OrcaAgentConfig | undefined,
  resolve: Resolver
): ClaudeEnvResult {
  if (!agent) return { env: {}, missing: [] }

  const env: Record<string, string> = {}
  const missing = new Set<string>()
  const provider = present(agent.provider)?.trim().toLowerCase()

  if (provider === 'bedrock') env.CLAUDE_CODE_USE_BEDROCK = '1'
  else if (provider === 'vertex') env.CLAUDE_CODE_USE_VERTEX = '1'
  else if (provider && provider !== 'anthropic') {
    console.warn(`[orca-config] 알 수 없는 claude-code provider '${agent.provider}' — 무시`)
  }

  setExpanded(env, 'ANTHROPIC_API_KEY', agent.authToken, resolve, missing)
  setExpanded(env, 'ANTHROPIC_BASE_URL', agent.baseUrl, resolve, missing)

  for (const [key, value] of Object.entries(agent.env ?? {})) {
    setExpanded(env, key, value, resolve, missing)
  }

  return { env, missing: [...missing] }
}

function processEnvRecord(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) out[key] = value
  }
  return out
}

export function mergeAgentEnv(
  base: Record<string, string> | undefined,
  agentEnv: Record<string, string>
): Record<string, string> | undefined {
  if (Object.keys(agentEnv).length === 0) return base
  return { ...(base ?? processEnvRecord()), ...agentEnv }
}
