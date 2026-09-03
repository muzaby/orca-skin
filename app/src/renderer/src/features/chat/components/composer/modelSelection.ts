import type { AgentEnvironment, AgentModelView } from '../../../../../../shared/ipc'
import { modelIdentity } from '../../../../../../shared/model-identity'

export interface ModelSelection {
  providerKey: string
  modelFamily: string | null
  adapter: string
  provider?: string
  // 선택 모델의 계열 — 권한 모드 강등 판정의 입력(0215 D-009). **선택 필드가 아니다**:
  // 빠뜨리면 haiku 판정이 조용히 false 가 되므로 타입이 세 생산 지점을 모두 강제한다.
  // `null` = 아직 모델이 정해지지 않음(default hydration 대기).
  modelAlias: string | null
}

// 선택 식별자의 정본은 `shared/model-identity.ts` 다(0215 D-007) — main 의 동명 함수와 **같은
// 곳**에 위임한다. 여기서 자체 계산하면 `[1m]` 이 한쪽에만 실려 두 행이 구분되지 않는다.
export function modelKey(model: AgentModelView): string {
  return modelIdentity(model)
}

export function defaultSelection(
  agents: AgentEnvironment[],
  sessionBackend: string | null
): ModelSelection | null {
  for (const agent of agents) {
    if (!agent.supported) continue
    if (sessionBackend && agent.adapter !== sessionBackend) continue
    const model = agent.models.find((m) => m.isDefault) ?? agent.models[0]
    return {
      providerKey: agent.key,
      modelFamily: model ? modelKey(model) : null,
      modelAlias: model ? model.alias : null,
      adapter: agent.adapter,
      provider: agent.provider
    }
  }
  return null
}

// 선택이 아직 카탈로그에 있는가 — adapter 는 판정에 참여하지 않으므로 받지 않는다
// (`modelFamily == null` 은 default hydration 대기 중이라 provider 존재만 본다).
export function selectionExists(
  agents: AgentEnvironment[],
  providerKey: string,
  modelFamily: string | null
): boolean {
  return agents.some(
    (agent) =>
      agent.key === providerKey &&
      (modelFamily == null || agent.models.some((model) => modelKey(model) === modelFamily))
  )
}

// 선택 없음(null)이면 null — '모델' 폴백 라벨은 렌더(Composer)가 tr 로 채운다(0097).
export function selectionLabel(selection: ModelSelection | null): string | null {
  if (!selection) return null
  // adapter 제외 — provider 가 있으면 provider, 없으면 providerKey(=adapter 단독) 폴백.
  const left = selection.provider ?? selection.providerKey
  return selection.modelFamily ? `${left}/${selection.modelFamily}` : left
}

// 선택된 모델의 계열 형상 — 권한 모드 가부 판정의 입력(0215 D-009·D-011).
//
// 카탈로그를 아는 renderer 만 alias 축을 볼 수 있다. main 은 SDK 모델 문자열만 갖는다.
// `null` = 아직 선택 없음 → 호출부는 제약 없는 기본 목록을 쓴다.
export function selectedModelShape(
  agents: AgentEnvironment[],
  selection: ModelSelection | null
): { alias: string; model: string | null } | null {
  if (!selection?.modelFamily) return null
  const agent = agents.find((a) => a.key === selection.providerKey)
  const model = agent?.models.find((m) => modelKey(m) === selection.modelFamily)
  if (model) return { alias: model.alias, model: model.model }
  // 카탈로그에서 못 찾으면(하이드레이션 지연·기여 회수) 선택값이 들고 있는 것만으로 판정한다 —
  // 판정 불가를 "제약 없음" 으로 흘리면 지원하지 않는 모드가 열린다.
  return { alias: selection.modelAlias ?? '', model: selection.modelFamily }
}
