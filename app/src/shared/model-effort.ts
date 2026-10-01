import type { EffortLevel } from './ipc'
import {
  CLAUDE_MODEL_FAMILIES,
  parseClaudeModelName,
  type ClaudeNameFamily,
  type ClaudeModelVersion
} from './model-identity'

interface ClaudeDefaultEffort {
  readonly family: ClaudeNameFamily
  readonly major: number
  readonly minor: number
  readonly effort: EffortLevel
}

// Claude Code 2.1.286 defaults. smoke-effort-sdk.mjs checks these against the bundled CLI.
export const CLAUDE_MODEL_DEFAULT_EFFORT: readonly ClaudeDefaultEffort[] = [
  { family: 'fable', major: 5, minor: 1, effort: 'high' },
  { family: 'fable', major: 5, minor: 0, effort: 'high' },
  { family: 'opus', major: 5, minor: 5, effort: 'medium' },
  { family: 'sonnet', major: 5, minor: 5, effort: 'medium' },
  { family: 'opus', major: 5, minor: 0, effort: 'high' },
  { family: 'sonnet', major: 5, minor: 0, effort: 'high' },
  { family: 'opus', major: 4, minor: 8, effort: 'high' },
  { family: 'opus', major: 4, minor: 7, effort: 'xhigh' },
  { family: 'opus', major: 4, minor: 6, effort: 'high' },
  { family: 'sonnet', major: 4, minor: 6, effort: 'high' }
]

// Bare aliases follow the bundled CLI's Anthropic API resolution.
export const CLAUDE_ALIAS_VERSION: Readonly<
  Record<(typeof CLAUDE_MODEL_FAMILIES)[number], ClaudeModelVersion>
> = {
  opus: { major: 5, minor: 5 },
  sonnet: { major: 5, minor: 5 },
  fable: { major: 5, minor: 1 },
  haiku: { major: 4, minor: 5 }
}

export const CLAUDE_UNLISTED_EFFORT: EffortLevel = 'high'
export const CUSTOM_MODEL_EFFORT: EffortLevel = 'high'

export function defaultEffortForModel(model: string | null | undefined): EffortLevel {
  const name = model
    ?.replace(/\[1m\]/gi, '')
    .trim()
    .toLowerCase()
  if (!name) return CUSTOM_MODEL_EFFORT
  const parsed = parseClaudeModelName(name)
  if (!parsed) return CUSTOM_MODEL_EFFORT
  const alias = CLAUDE_MODEL_FAMILIES.find((family) => family === name)
  const version = parsed.version ?? (alias ? CLAUDE_ALIAS_VERSION[alias] : undefined)
  if (!version) return CLAUDE_UNLISTED_EFFORT
  return (
    CLAUDE_MODEL_DEFAULT_EFFORT.find(
      (row) =>
        row.family === parsed.family && row.major === version.major && row.minor === version.minor
    )?.effort ?? CLAUDE_UNLISTED_EFFORT
  )
}
