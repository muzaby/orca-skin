// 현재 지원하는 OpenCode 구현을 선택하는 진입점. SDK/CLI의 버전 계약은 v1 안에 둔다.
export { OpenCodeAdapter } from './v1/adapter'
export { OpenCodeServerPool } from './v1/server'
export type { OpenCodeConnection, OpenCodeServerDependencies } from './v1/server'
export {
  loadOpenCodeProviderSettings,
  parseOpenCodeModels,
  readUserOpenCodeSettings
} from './v1/settings'
