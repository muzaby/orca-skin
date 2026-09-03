// 모델 식별자 · 모델 계열 판정 (0215).
//
// 순수 타입/함수만 — zod·SDK·electron 을 import 하지 않는다. `shared/` 는 preload(sandbox=true)
// 와 renderer·main 이 모두 import 하므로 런타임 의존이 없어야 한다(`permission-mode.ts` 와 동형).
//
// **왜 shared 인가**: 같은 규칙이 main(`features/harnesses/models.ts`)과 renderer
// (`features/chat/.../modelSelection.ts`)에 복제돼 있었고, 그 복제가 `[1m]` 축을 한쪽만
// 반영할 수 있는 자리였다. 규칙을 한 곳으로 올려 두 소비처가 위임만 하게 한다.

// 식별자 계산에 필요한 최소 형상. main 의 `ParsedModel` 과 wire 의 `AgentModelView` 가
// 둘 다 구조적으로 만족한다 — shared 는 그 둘 어느 쪽도 import 하지 않는다.
export interface ModelIdentityInput {
  alias: string
  model: string | null
  oneMillionContext: boolean
}

// 모델 선택 식별자 = **SDK 에 넘기는 모델 문자열**(0215 D-007).
//
// `model` 이 null(커스텀 미구성)이면 bare alias 를 그대로 쓴다 — SDK 가 해석하므로 모델명을
// 추측하지 않는다. `oneMillionContext` 면 `[1m]` 을 재부착한다: 접미사는 표시/매칭을 위해
// 파서가 떼어낸 것이고, 실행 경로와 **선택 식별자**에서는 되살아나야 한다.
//
// 이 값이 곧 `options.model` 이라 두 값이 갈라질 자리가 없다. `X` 와 `X[1m]` 은 서로 다른
// 실행 대상이므로 식별자도 달라야 한다 — 같으면 메뉴의 두 행이 구분되지 않는다.
export function modelIdentity(model: ModelIdentityInput): string {
  const base = model.model ?? model.alias
  return model.oneMillionContext ? `${base}[1m]` : base
}

// 두 항목이 같은 모델인가 — dedupe 와 선택 매칭의 단일 술어(0215 D-008).
export function sameModelIdentity(a: ModelIdentityInput, b: ModelIdentityInput): boolean {
  return modelIdentity(a) === modelIdentity(b)
}

// haiku 계열인가 (0215 D-009 — 사용자 결정).
//
// 두 축을 **모두** 본다. `alias` 는 `ANTHROPIC_DEFAULT_HAIKU_MODEL` 로 선언한 계열이라
// 모델명에 haiku 가 없어도 haiku 이고, 반대로 discovery 로 들어온 이름은 alias 가 `custom`
// 이어도 이름이 haiku 를 담을 수 있다. 어느 한 축만 보면 나머지 절반이 샌다.
//
// CLI 실물(`oqe()`)은 `claude-haiku-4-5` 와 비-firstParty 의 `includes("haiku")` 를 auto 에서
// 제외한다 — 이 술어는 그보다 **넓다**(사용자 결정). 편차는 plan §16 에 남겼다.
export function isHaikuModel(model: { alias: string; model: string | null }): boolean {
  if (model.alias.toLowerCase() === 'haiku') return true
  return (model.model ?? '').toLowerCase().includes('haiku')
}
