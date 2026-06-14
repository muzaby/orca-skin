// 모델 해석 (handoff 0017 D2 분해 — 구 provider-settings.ts 의 "모델 해석" 책임).
// sources/settings/<adapter>/meta.json 의 provider 별 models 가 원천이며, family→name 해석과
// orca:agent:list 페이로드 변환을 담당한다. 순수 함수 — vitest 대상.

import { z } from 'zod'
import type { AgentEnvironment, AgentModelView } from '../../shared/ipc'

// 모델 항목 스키마 — 구 orca.json agents[].models 와 동일 (handoff 0010). 이제는
// sources/settings/<adapter>/meta.json 의 provider 별 models 가 원천이다.
export const OrcaModelSchema = z.object({
  name: z.string().min(1),
  family: z.string().optional(),
  default: z.boolean().optional()
})
export type OrcaModelConfig = z.infer<typeof OrcaModelSchema>

export function modelKey(model: OrcaModelConfig): string {
  return model.family ?? model.name
}

export function modelNameForFamily(
  models: OrcaModelConfig[],
  family: string | null | undefined
): string | undefined {
  if (models.length === 0) return undefined
  const wanted = family?.trim()
  const byFamily = wanted
    ? models.find((model) => modelKey(model) === wanted || model.name === wanted)
    : undefined
  const selected = byFamily ?? models.find((model) => model.default) ?? models[0]
  return selected?.name
}

export function defaultModelFamily(models: OrcaModelConfig[]): string | null {
  if (models.length === 0) return null
  const selected = models.find((model) => model.default) ?? models[0]
  return selected ? modelKey(selected) : null
}

// ProviderEntry(provider-registry.ts)를 orca:agent:list 페이로드로 — shape 는 handoff 0010 과
// 동일 유지 (renderer ModelMenu 변경 0). 순환을 피해 구조적 입력만 받는다(ProviderEntry 미import).
export function toAgentEnvironments(
  entries: { key: string; adapter: string; provider: string; models: OrcaModelConfig[] }[],
  supportedAdapters: Iterable<string>
): AgentEnvironment[] {
  const supported = new Set(supportedAdapters)
  return entries.map((entry) => ({
    key: entry.key,
    adapter: entry.adapter,
    provider: entry.provider,
    supported: supported.has(entry.adapter),
    models: entry.models.map(
      (model): AgentModelView => ({
        name: model.name,
        ...(model.family ? { family: model.family } : {}),
        ...(model.default !== undefined ? { default: model.default } : {})
      })
    )
  }))
}
