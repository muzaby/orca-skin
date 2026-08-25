// 모델 해석 (handoff 0017 D2; settings-json-model-parser 로 meta.json 제거 후 재정의).
// provider 별 모델은 이제 sources/settings/<adapter>/<provider>/settings.json 을 claude/model-parser.ts
// 로 파싱해 얻는다(provider-registry.listProviders). 본 모듈은 alias→name 해석과 orca:agent:list
// 페이로드 변환을 담당한다. 순수 함수 — vitest 대상.

import type { AgentEnvironment, AgentModelView } from '../../../shared/ipc'
import type { ParsedModel } from './claude/model-parser'

export type { ParsedModel } from './claude/model-parser'

export function canonicalAgentKey(key: string): string {
  return key.trim().toLowerCase()
}

export function modelKey(model: ParsedModel): string {
  return model.model ?? model.alias
}

// 선택된 alias 를 SDK 에 넘길 model 문자열로 해석. model 이 null(커스텀 미구성)이면 bare alias
// (sonnet/opus/haiku)를 그대로 넘겨 SDK 가 해석하게 한다 — 추측 금지(모델명 임의 생성 안 함).
// oneMillionContext(설정의 `[1m]` 접미사, 0142)면 접미사를 **재부착**해 SDK query 의 options.model
// 로 넘긴다 — Claude Code CLI 는 model 문자열의 `[1m]` 를 1M 컨텍스트 베타로 번역한다. 파서가
// 표시/매칭용으로 떼어낸 접미사를 실행 경로에서만 되살린다(도넛 modelUsage 키는 해석 ID 라 무관).
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
  const base = selected.model ?? selected.alias
  return selected.oneMillionContext ? `${base}[1m]` : base
}

export function defaultModelFamily(models: ParsedModel[]): string | null {
  if (models.length === 0) return null
  const selected = models.find((model) => model.isDefault) ?? models[0]
  return selected ? modelKey(selected) : null
}

// 제목 생성용 모델 선택 정책: 저가 모델('haiku' alias)이 있으면 그것을, 없으면 provider default
// 로 해석한다(요청 전 사전 선택 — 어댑터는 실패-후-재시도 폴백을 두지 않는다). 모델 목록이 비면
// undefined → SDK 기본 모델. 모델 티어 어휘는 settings 레이어 책임이라 여기 둔다.
export function resolveTitleModel(models: ParsedModel[]): string | undefined {
  const haiku = models.find((model) => model.alias === 'haiku')
  return modelNameForFamily(models, haiku ? modelKey(haiku) : null)
}

// 도메인 entry → `orca:agent:list` 행. 순환을 피해 구조적 입력만 받는다(HarnessModelProviderEntry
// 미import). ParsedModel 은 필드 변환 없이 그대로 통과시킨다.
//
// **행을 만드는 자리는 여기 하나다** — settings 원천과 runtime 카탈로그가 같은 함수를 지나야
// wire 필드가 늘 때 한쪽만 갱신되는 드리프트가 생기지 않는다.
// **wire 필드명은 유지한다** (0188 D-030) — `AgentEnvironment.adapter`/`.provider` 는 renderer
// 가 읽는 compat 계약이다. 도메인 어휘(harnessId·modelProviderId)는 이 경계에서 변환한다.
export function toAgentEnvironment(
  entry: { key: string; harnessId: string; modelProviderId: string; models: ParsedModel[] },
  provenance: { supported: boolean; source: 'settings' | 'runtime'; readOnly: boolean }
): AgentEnvironment {
  return {
    key: entry.key,
    adapter: entry.harnessId,
    provider: entry.modelProviderId,
    supported: provenance.supported,
    source: provenance.source,
    readOnly: provenance.readOnly,
    models: entry.models.map((model): AgentModelView => ({
      alias: model.alias,
      model: model.model,
      isCustom: model.isCustom,
      oneMillionContext: model.oneMillionContext,
      isDefault: model.isDefault
    }))
  }
}

export function toAgentEnvironments(
  entries: { key: string; harnessId: string; modelProviderId: string; models: ParsedModel[] }[],
  supportedHarnesses: Iterable<string>
): AgentEnvironment[] {
  const supported = new Set(supportedHarnesses)
  return entries.map((entry) =>
    toAgentEnvironment(entry, {
      supported: supported.has(entry.harnessId),
      source: 'settings',
      readOnly: false
    })
  )
}

export function mergeAgentEnvironments(
  settings: AgentEnvironment[],
  runtime: AgentEnvironment[],
  isRuntimeManaged: (key: string) => boolean = () => false
): AgentEnvironment[] {
  // A declared runtime contribution owns its canonical row even while its cache is empty. Keeping
  // a colliding settings row here would expose an editable card that turn setup still treats as
  // runtime-managed, so the UI would offer an action whose execution can only fail.
  const merged = new Map(
    settings
      .filter((entry) => !isRuntimeManaged(entry.key))
      .map((entry) => [canonicalAgentKey(entry.key), entry])
  )
  for (const entry of runtime) merged.set(canonicalAgentKey(entry.key), entry)
  return [...merged.values()]
}
