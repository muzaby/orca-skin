import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentModelView, EngineUserSettingsResult } from '../../../../shared/ipc'
import { isRecord } from '../../../../shared/obj'
import type { HarnessRuntimeConfig, HarnessSettingsLoader } from '../../common/harness-config'

// 전역 설정의 원문만 읽는다. 파싱/저장은 엔진 모달의 기존 편집 흐름이 담당한다.
export function readUserOpenCodeSettings(
  configRoot = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
): EngineUserSettingsResult {
  try {
    return {
      exists: true,
      settingsJson: readFileSync(join(configRoot, 'opencode', 'opencode.json'), 'utf8')
    }
  } catch {
    return { exists: false, settingsJson: '' }
  }
}

export const loadOpenCodeProviderSettings: HarnessSettingsLoader = async ({
  sourcesSettingsFile
}) => {
  // 호스트 설정만 쓰는 runtime 키(0291)는 settings.json 이 없다 — 부재는 빈 설정이다.
  // 읽기·JSON 오류는 그대로 던진다.
  let raw: string
  try {
    raw = readFileSync(sourcesSettingsFile, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return { settings: {} }
    throw error
  }
  const parsed: unknown = JSON.parse(raw)
  if (!isRecord(parsed)) throw new Error('OpenCode 설정은 JSON 객체여야 합니다.')
  return { settings: parsed }
}

function variantNames(variants: unknown): string[] {
  return isRecord(variants)
    ? Object.entries(variants)
        .filter(([, v]) => !isRecord(v) || v.disabled !== true)
        .map(([k]) => k)
    : []
}

function modelRow(
  providerId: string,
  modelId: string,
  name: unknown,
  variants: string[]
): AgentModelView {
  return {
    alias: typeof name === 'string' ? name : modelId,
    model: `${providerId}/${modelId}`,
    providerId,
    isCustom: true,
    oneMillionContext: false,
    isDefault: false,
    variants
  }
}

// 읽기 전용 runtime 행(0291) — 배포 augmenter 가 호스트 `opencode models` 결과로 채운
// `availableModels`(`provider/model`) 순서를 보존한다. 형식이 아닌 항목은 버리고 첫 행이 기본이다.
export function parseOpenCodeRuntimeModels(config: HarnessRuntimeConfig): AgentModelView[] {
  const listed = Array.isArray(config.availableModels) ? config.availableModels : []
  const models: AgentModelView[] = []
  const seen = new Set<string>()
  for (const id of listed) {
    if (typeof id !== 'string' || seen.has(id)) continue
    const slash = id.indexOf('/')
    if (slash <= 0 || slash === id.length - 1) continue
    seen.add(id)
    const detail = config.modelDetails?.[id]
    models.push(
      modelRow(id.slice(0, slash), id.slice(slash + 1), detail?.name, [...(detail?.variants ?? [])])
    )
  }
  if (models.length > 0) models[0]!.isDefault = true
  return models
}

export function parseOpenCodeModels(config: Record<string, unknown>): AgentModelView[] {
  const models: AgentModelView[] = []
  if (!isRecord(config.provider)) return models
  for (const [providerId, provider] of Object.entries(config.provider)) {
    if (!isRecord(provider) || !isRecord(provider.models)) continue
    for (const [modelId, definition] of Object.entries(provider.models)) {
      const details = isRecord(definition) ? definition : {}
      const row = modelRow(providerId, modelId, details.name, variantNames(details.variants))
      row.isDefault = config.model === row.model
      models.push(row)
    }
  }
  if (models.length > 0 && !models.some((model) => model.isDefault)) models[0]!.isDefault = true
  return models
}
