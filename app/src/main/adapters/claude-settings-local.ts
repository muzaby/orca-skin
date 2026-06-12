// Claude provider settings materializer — 사용자가 편집하는 Orca provider settings 원본을
// Claude Code 가 기본 settings source 정책으로 읽는 작업 디렉토리의 local settings 파일로 복사한다.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ResolvedProviderSettings } from '../settings/provider-settings'

export function materializeLocalSettings(
  cwd: string,
  blob?: ResolvedProviderSettings
): string | undefined {
  if (!blob || !existsSync(blob.sourcesSettingsFile)) return undefined
  const destDir = join(cwd, '.claude')
  const dest = join(destDir, 'settings.local.json')
  mkdirSync(destDir, { recursive: true })
  copyFileSync(blob.sourcesSettingsFile, dest)
  return dest
}
