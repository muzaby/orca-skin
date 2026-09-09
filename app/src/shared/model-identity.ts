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

// Discovery 분류와 권한 판정이 같은 계열을 인식한다. 기본 alias 목록과는 별개다.
export const CLAUDE_MODEL_FAMILIES = ['sonnet', 'opus', 'haiku', 'fable'] as const

const AUTO_PERMISSION_MODEL_PATTERN = new RegExp(
  String.raw`^(?:(?:(?:us|eu|apac|global)\.)?anthropic[./])?claude(?:code)?-(?:${CLAUDE_MODEL_FAMILIES.join('|')})-(\d+)(?:[.-](\d{1,2}))?(?:-\d{8})?(?:-v\d+(?::\d+)?)?$`,
  'i'
)

// 자동 승인은 명시적으로 버전을 아는 Claude만 허용한다. alias/커스텀 provider 이름을
// 최신 모델의 증거로 사용하지 않는다. 날짜 접미사는 minor 버전이 아니다.
export function supportsAutoPermission(modelName: string | null | undefined): boolean {
  if (!modelName) return false
  const name = modelName.trim().replace(/\[1m\]$/i, '')
  const match = AUTO_PERMISSION_MODEL_PATTERN.exec(name)
  if (!match) return false
  const major = Number(match[1])
  const minor = Number(match[2] ?? '0')
  return major > 4 || (major === 4 && minor > 5)
}
