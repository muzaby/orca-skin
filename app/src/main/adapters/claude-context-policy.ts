import {
  CLAUDE_MODEL_FAMILIES,
  parseClaudeModelName,
  type ClaudeNameFamily
} from '../../shared/model-identity'
import { isRecord } from '../../shared/obj'
import type { HarnessNativeSettings } from './harness-config'

export type ContextEnvLookup = (key: string) => string | undefined

const ONE_M_SUFFIX = /\[1m\]/i
const THIRD_PARTY_FLAGS = [
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDE_CODE_USE_MANTLE',
  'CLAUDE_CODE_USE_ANTHROPIC_AWS',
  'CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD'
] as const

export function classifyContextModel(model?: string): {
  kind: 'default' | 'claude' | 'custom'
  contextWindow: 200_000 | 1_000_000
  has1mSuffix: boolean
  family?: ClaudeNameFamily
  major?: number
  minor?: number
} {
  const has1mSuffix = ONE_M_SUFFIX.test(model ?? '')
  if (!model) return { kind: 'default', contextWindow: 200_000, has1mSuffix }
  const parsed = parseClaudeModelName(model)
  if (!parsed) {
    return { kind: 'custom', contextWindow: has1mSuffix ? 1_000_000 : 200_000, has1mSuffix }
  }
  const { family } = parsed
  const major = parsed.version?.major
  const minor = parsed.version?.minor ?? 0
  const native1m =
    family === 'fable' ||
    family === 'mythos' ||
    (family === 'opus' && major !== undefined && (major > 4 || (major === 4 && minor >= 7))) ||
    (family === 'sonnet' && major !== undefined && major >= 5)
  return {
    kind: 'claude',
    contextWindow: has1mSuffix || native1m ? 1_000_000 : 200_000,
    has1mSuffix,
    family,
    ...(major !== undefined ? { major, minor } : {})
  }
}

// Prepared env is the complete subprocess environment. Without it, settings env
// overrides the inherited environment, as it does in the CLI. Neither is mutated.
export function envLookup(
  env: Record<string, string> | undefined,
  settings: HarnessNativeSettings | undefined,
  inherited: Record<string, string | undefined>
): ContextEnvLookup {
  const settingsEnv = isRecord(settings?.env) ? settings.env : undefined
  return (key) => {
    if (env !== undefined) return env[key]
    const value = settingsEnv?.[key]
    return typeof value === 'string' ? value : inherited[key]
  }
}

export function resolveCliModel(
  model: string | undefined,
  lookup: ContextEnvLookup,
  settingsModel?: unknown
): string | undefined {
  const selected =
    model ||
    lookup('ANTHROPIC_MODEL') ||
    (typeof settingsModel === 'string' ? settingsModel : undefined)
  if (!selected) return undefined
  const alias = selected.replace(/\[1m\]/gi, '').toLowerCase()
  if (!(CLAUDE_MODEL_FAMILIES as readonly string[]).includes(alias)) return selected
  return lookup(`ANTHROPIC_DEFAULT_${alias.toUpperCase()}_MODEL`) || selected
}

function enabled(value?: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '')
}

export function modelForCli(
  model: string | undefined,
  lookup: ContextEnvLookup,
  settingsModel?: unknown
): string | undefined {
  const resolved = resolveCliModel(model, lookup, settingsModel)
  const classification = classifyContextModel(resolved)
  if (
    classification.kind !== 'claude' ||
    classification.contextWindow !== 1_000_000 ||
    classification.has1mSuffix ||
    ONE_M_SUFFIX.test(model ?? '') ||
    enabled(lookup('CLAUDE_CODE_DISABLE_1M_CONTEXT'))
  )
    return model

  const thirdParty = THIRD_PARTY_FLAGS.some((flag) => enabled(lookup(flag)))
  if (thirdParty && classification.family === 'sonnet' && (classification.major ?? 0) >= 5)
    return model
  const baseUrl = lookup('ANTHROPIC_BASE_URL')
  let direct = !thirdParty && !baseUrl
  if (!thirdParty && baseUrl) {
    try {
      direct = new URL(baseUrl).hostname === 'api.anthropic.com'
    } catch {
      direct = false
    }
  }
  return direct ? model : `${model || resolved}[1m]`
}
