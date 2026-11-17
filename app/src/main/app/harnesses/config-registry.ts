// 하네스 구성의 조립 — 실행 없이 읽는 부분 (0324 EP-1 (e3) · 구현 보고 G-B).
//
// 설정 트리 열거·모델 파서·스킬 폴더·설정 뼈대는 파일만 읽는다. 데이터 호스트(상태)가 이것을 쓰고,
// 어댑터를 만드는 조립(`registry.ts`)은 에이전트 호스트(실행)만 쓴다. 이 파일에서 어댑터 구현·SDK·
// 프로세스 기동에 닿으면 가드 (e3) 가 실패한다.

import type { Backend } from '../../../shared/ipc'
import type { HarnessRuntimeConfig } from '../../adapters/common/harness-config'
import type { ParsedModel } from '../../features/harnesses/common/model-types'
import { HarnessSettingsService } from '../../features/harnesses/common/settings'
import { claudeConfigModule } from './claude/config'
import type { HarnessConfigModule } from './common/contracts'
import { openCodeConfigModule } from './opencode/config'

export const harnessConfigModules: Readonly<Record<Backend, HarnessConfigModule>> = {
  claude: claudeConfigModule,
  opencode: openCodeConfigModule
}

// Preserve unsupported source-directory rows and existing runtime contributions explicitly.
// Native settings parsing for a registered harness never falls back to a sibling module.
function moduleFor(harnessId: string): HarnessConfigModule {
  return harnessConfigModules[harnessId as Backend] ?? claudeConfigModule
}

export function parseHarnessSettingsModels(
  harnessId: string,
  settings: Record<string, unknown>
): ParsedModel[] {
  return moduleFor(harnessId).parseSettingsModels(settings)
}

export function parseHarnessRuntimeModels(config: HarnessRuntimeConfig): ParsedModel[] {
  const parse =
    moduleFor(config.harnessId).parseRuntimeModels ?? claudeConfigModule.parseRuntimeModels!
  return parse(config)
}

export function createHarnessSettingsService(root?: string): HarnessSettingsService {
  return new HarnessSettingsService(
    Object.fromEntries(
      Object.values(harnessConfigModules).map((module) => [module.id, module.loadSettings])
    ),
    root,
    parseHarnessSettingsModels
  )
}

export {
  claudeSkillRoots as harnessSkillRoots,
  scaffoldClaudeSettings as scaffoldHarnessSettings
} from './claude/config'
