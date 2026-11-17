// OpenCode 구성 — 실행 없이 읽는 부분 (0324 EP-1 (e3)). 어댑터·서버·SDK 를 끌어오지 않는다.
import {
  loadOpenCodeProviderSettings,
  parseOpenCodeModels,
  parseOpenCodeRuntimeModels
} from '../../../adapters/opencode/config'
import type { HarnessConfigModule } from '../common/contracts'

export const openCodeConfigModule: HarnessConfigModule = {
  id: 'opencode',
  loadSettings: loadOpenCodeProviderSettings,
  parseSettingsModels: parseOpenCodeModels,
  parseRuntimeModels: parseOpenCodeRuntimeModels
}
