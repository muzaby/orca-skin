// 모델 해석 (handoff 0017 D2; settings-json-model-parser 로 meta.json 제거 후 재정의).
// provider 별 모델은 이제 sources/settings/<adapter>/<provider>/settings.json 을 claude-model-parser
// 로 파싱해 얻는다(provider-registry.listProviders). 본 모듈은 alias→name 해석과 orca:agent:list
// 페이로드 변환을 담당한다. 순수 함수 — vitest 대상.

import type { AgentEnvironment, AgentModelView } from '../../shared/ipc'
import type { ParsedModel } from './claude-model-parser'

export type { ParsedModel } from './claude-model-parser'

export function modelKey(model: ParsedModel): string {
  return model.alias
}

// 선택된 alias 를 SDK 에 넘길 model 문자열로 해석. model 이 null(커스텀 미구성)이면 bare alias
// (sonnet/opus/haiku)를 그대로 넘겨 SDK 가 해석하게 한다 — 추측 금지(모델명 임의 생성 안 함).
export function modelNameForFamily(
  models: ParsedModel[],
  alias: string | null | undefined
): string | undefined {
  if (models.length === 0) return undefined
  const wanted = alias?.trim()
  const byAlias = wanted
    ? models.find((model) => model.alias === wanted || model.model === wanted)
    : undefined
  const selected = byAlias ?? models.find((model) => model.isDefault) ?? models[0]
  if (!selected) return undefined
  return selected.model ?? selected.alias
}

export function defaultModelFamily(models: ParsedModel[]): string | null {
  if (models.length === 0) return null
  const selected = models.find((model) => model.isDefault) ?? models[0]
  return selected ? selected.alias : null
}

// 제목 생성용 모델 선택 정책: 저가 모델('haiku' alias)이 있으면 그것을, 없으면 provider default
// 로 해석한다(요청 전 사전 선택 — 어댑터는 실패-후-재시도 폴백을 두지 않는다). 모델 목록이 비면
// undefined → SDK 기본 모델. 모델 티어 어휘는 settings 레이어 책임이라 여기 둔다.
export function resolveTitleModel(models: ParsedModel[]): string | undefined {
  const hasHaiku = models.some((model) => model.alias === 'haiku')
  return modelNameForFamily(models, hasHaiku ? 'haiku' : null)
}

// ProviderEntry(provider-registry.ts)를 orca:agent:list 페이로드로 변환. 순환을 피해 구조적
// 입력만 받는다(ProviderEntry 미import). ParsedModel 을 필드 변환 없이 그대로 통과시킨다.
export function toAgentEnvironments(
  entries: { key: string; adapter: string; provider: string; models: ParsedModel[] }[],
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
        alias: model.alias,
        model: model.model,
        isCustom: model.isCustom,
        oneMillionContext: model.oneMillionContext,
        isDefault: model.isDefault
      })
    )
  }))
}
