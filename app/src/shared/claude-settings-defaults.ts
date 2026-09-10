import { isRecord } from './obj'

// Windows 앱의 provider 템플릿과 SDK 실행 설정이 공유하는 기본값.
// 명시 설정을 덮지 않으며 사용자 파일을 변경하지 않는다.
export const CLAUDE_DEFAULT_SETTINGS = { skipWebFetchPreflight: true } as const
export const CLAUDE_DEFAULT_ENV = { CLAUDE_CODE_USE_POWERSHELL_TOOL: '1' } as const

export function withClaudeSettingsDefaults(
  settings: Record<string, unknown> = {},
  powerShellFallback: string = CLAUDE_DEFAULT_ENV.CLAUDE_CODE_USE_POWERSHELL_TOOL
): Record<string, unknown> {
  return {
    ...CLAUDE_DEFAULT_SETTINGS,
    ...settings,
    env: {
      CLAUDE_CODE_USE_POWERSHELL_TOOL: powerShellFallback,
      ...(isRecord(settings.env) ? settings.env : {})
    }
  }
}
