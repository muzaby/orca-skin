// Auth 등록 (0181 → 0188) — 빌드타임 선언 배열을 받아 검사하고 목록을 확정한다.
//
// **런타임 동적 로딩은 없다**(구 `contracts/auth-method.ts` 의 결정 유지). 배포는 선언 파일을
// 고쳐 다시 빌드한다. 그래서 검사도 둘뿐이다:
//   1. **중복 `id` 거부** — opencode 의 last-writer-wins 는 채택하지 않는다. id 는 vault
//      네임스페이스이자 `${BINDING:<id>}` 참조 대상이라, 조용히 덮어쓰면 사용자의 저장된
//      자격증명이 다른 Auth 것으로 읽힌다.
//   2. **`origin` 형태** — 경로·쿼리·해시가 붙은 값은 origin 이 아니다. 이 값이 나중에
//      요청 정책의 기준이 되므로(`policy.ts`), 형태가 어긋난 채 등록되면 판정이 헐거워진다.
//
// **gate probe 검사는 여기 없다 (0188).** 구 규칙(`kind:'gate' && !probe → missing_probe`)은
// Auth 코어가 "내가 gate 에 쓰인다" 를 알아야 성립했다. 그 강제는 소비 측으로 옮겼다 —
// `contracts/auth.ts` 의 `GateAuthDefinition` 타입이 compile time 에, 부팅 composition 이
// runtime 에 fail-closed 한다(0188 D-007). 확인 없이 통과하는 게이트는 여전히 금지다.
//
// **거부는 그 선언 하나만 떨어뜨린다.** 구 구조는 패키지 단위 all-or-nothing 이라 `baseUrl`
// 하나가 경로를 달고 있으면 그 패키지의 대상이 통째로 사라졌다(0164). 여기서는 나머지가
// 그대로 등록되고, 사유는 진단으로 남는다.

import type { AuthDefinition, AuthId } from '../../contracts/auth'

export interface AuthRejection {
  id: AuthId
  reason: 'duplicate_id' | 'invalid_id' | 'invalid_origin'
  message: string
}

// 케밥 소문자. **주석이 아니라 검사여야 하는 이유**: id 는 SDK MCP 서버 이름(`<id>-tools`)과
// `${BINDING:<id>}` 파서(`infra/vars.ts` — `[A-Za-z0-9_-]+`)로 흘러간다. 범위 밖 문자를 쓰면
// 등록·로그인·vault 저장은 전부 통과하는데 도구 노출과 MCP 참조만 **조용히** 깨진다.
const AUTH_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface RegistryResult {
  definitions: AuthDefinition[]
  rejected: AuthRejection[]
}

// origin = scheme + host + (port). 경로·쿼리·해시가 있으면 거짓. `URL` 이 정규화한 origin 과
// 원문이 **글자까지 같아야** 통과한다 — 후행 슬래시(`https://x/`)도 거부다.
export function isBareOrigin(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.origin === raw && url.origin !== 'null'
  } catch {
    return false
  }
}

export function registerAuthDefinitions(declared: readonly AuthDefinition[]): RegistryResult {
  const definitions: AuthDefinition[] = []
  const rejected: AuthRejection[] = []
  const seen = new Set<string>()

  for (const definition of declared) {
    if (seen.has(definition.id)) {
      rejected.push({
        id: definition.id,
        reason: 'duplicate_id',
        message: `auth id "${definition.id}" 가 중복 선언됐다`
      })
      continue
    }
    if (!AUTH_ID_RE.test(definition.id)) {
      rejected.push({
        id: definition.id,
        reason: 'invalid_id',
        message: `auth id "${definition.id}" 는 케밥 소문자(a-z0-9-)여야 한다`
      })
      continue
    }
    if (!isBareOrigin(definition.origin)) {
      rejected.push({
        id: definition.id,
        reason: 'invalid_origin',
        message: `origin "${definition.origin}" 에 경로·쿼리가 있거나 형식이 아니다`
      })
      continue
    }
    seen.add(definition.id)
    definitions.push(definition)
  }

  return { definitions, rejected }
}

export class AuthRegistry {
  private readonly accepted: AuthDefinition[]
  private readonly rejections: AuthRejection[]

  constructor(declared: readonly AuthDefinition[]) {
    const { definitions, rejected } = registerAuthDefinitions(declared)
    this.accepted = definitions
    this.rejections = rejected
  }

  list(): readonly AuthDefinition[] {
    return this.accepted
  }

  get(id: AuthId): AuthDefinition | undefined {
    return this.accepted.find((definition) => definition.id === id)
  }

  rejected(): readonly AuthRejection[] {
    return this.rejections
  }
}
