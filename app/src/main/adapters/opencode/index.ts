import { implementation } from './v1'

// 현재는 1.x만 선택한다. 향후 버전은 동일 중립 계약을 구현해 이 조립점에서 선택한다.
export const createOpenCodeAdapter = implementation.createAdapter
export const loadOpenCodeProviderSettings = implementation.loadSettings
export const parseOpenCodeModels = implementation.parseModels
export const readUserOpenCodeSettings = implementation.readUserSettings
export const configuredOpenCodeMcpFile = implementation.configuredMcpFile
export const configuredOpenCodeResources = implementation.configuredResources
export const openCodeSkillDirectories = implementation.skillDirectories
export const openCodePluginSkillDirectories = implementation.pluginSkillDirectories
export const openCodeContextWindow = implementation.contextWindow
export type { OpenCodeRuntimeOptions, OpenCodeServer } from './implementation'
