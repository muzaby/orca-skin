import { NORMALIZED_MODES, type NormalizedPermissionMode } from '../../permission-mode'

// SDK의 타입만 미러한다. renderer/preload에서도 사용할 수 있도록 SDK 런타임은 import하지 않는다.
export type ClaudePermissionMode =
  'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk' | 'auto'

const CLAUDE_PERMISSION_MODE = {
  default: 'default',
  accept_edits: 'acceptEdits',
  plan: 'plan',
  dont_ask: 'dontAsk',
  bypass: 'bypassPermissions',
  auto_classified: 'auto'
} as const satisfies Record<NormalizedPermissionMode, ClaudePermissionMode>

export function toClaudePermissionMode(mode: NormalizedPermissionMode): ClaudePermissionMode {
  return CLAUDE_PERMISSION_MODE[mode]
}

// SDK가 보고하지 않은 값에는 기본값을 만들지 않는다.
export function fromClaudePermissionMode(value: unknown): NormalizedPermissionMode | undefined {
  return NORMALIZED_MODES.find((mode) => CLAUDE_PERMISSION_MODE[mode] === value)
}
