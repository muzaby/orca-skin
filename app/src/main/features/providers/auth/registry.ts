// Provider 등록 (0181) — 빌드타임 선언 배열을 받아 검사하고 목록을 확정한다.
//
// **런타임 동적 로딩은 없다**(구 `contracts/auth-method.ts` 의 결정 유지). 배포는 선언 파일을
// 고쳐 다시 빌드한다. 그래서 검사도 둘뿐이다:
//   1. **중복 `id` 거부** — opencode 의 last-writer-wins 는 채택하지 않는다. id 는 vault
//      네임스페이스이자 `${BINDING:<id>}` 참조 대상이라, 조용히 덮어쓰면 사용자의 저장된
//      자격증명이 다른 provider 것으로 읽힌다.
//   2. **`origin` 형태** — 경로·쿼리·해시가 붙은 값은 origin 이 아니다. 이 값이 나중에
//      요청 정책의 기준이 되므로(`policy.ts`), 형태가 어긋난 채 등록되면 판정이 헐거워진다.
//
// **거부는 그 선언 하나만 떨어뜨린다.** 구 구조는 패키지 단위 all-or-nothing 이라 `baseUrl`
// 하나가 경로를 달고 있으면 그 패키지의 provider 가 통째로 사라졌다(0164). 여기서는 나머지가
// 그대로 등록되고, 사유는 진단으로 남는다.

import type { Provider } from '../../../contracts/provider'

export interface ProviderRejection {
  id: string
  reason: 'duplicate_id' | 'invalid_id' | 'invalid_origin' | 'missing_probe'
  message: string
}

// 케밥 소문자. **주석이 아니라 검사여야 하는 이유**: id 는 SDK MCP 서버 이름(`<id>-tools`)과
// `${BINDING:<id>}` 파서(`infra/vars.ts` — `[A-Za-z0-9_-]+`)로 흘러간다. 범위 밖 문자를 쓰면
// 등록·로그인·vault 저장은 전부 통과하는데 도구 노출과 MCP 참조만 **조용히** 깨진다.
const PROVIDER_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface RegistryResult {
  providers: Provider[]
  rejected: ProviderRejection[]
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

export function registerProviders(declared: readonly Provider[]): RegistryResult {
  const providers: Provider[] = []
  const rejected: ProviderRejection[] = []
  const seen = new Set<string>()

  for (const provider of declared) {
    if (seen.has(provider.id)) {
      rejected.push({
        id: provider.id,
        reason: 'duplicate_id',
        message: `provider id "${provider.id}" 가 중복 선언됐다`
      })
      continue
    }
    if (!PROVIDER_ID_RE.test(provider.id)) {
      rejected.push({
        id: provider.id,
        reason: 'invalid_id',
        message: `provider id "${provider.id}" 는 케밥 소문자(a-z0-9-)여야 한다`
      })
      continue
    }
    if (!isBareOrigin(provider.origin)) {
      rejected.push({
        id: provider.id,
        reason: 'invalid_origin',
        message: `origin "${provider.origin}" 에 경로·쿼리가 있거나 형식이 아니다`
      })
      continue
    }
    // 게이트는 앱 전체의 출입문이다. 확인 없이 통과하는 게이트는 곧 우회이므로, 선언이
    // probe 를 안 주면 등록하지 않는다 — "열려는 있는데 아무나 통과하는" 상태를 만들지 않는다.
    if (provider.kind === 'gate' && !provider.probe) {
      rejected.push({
        id: provider.id,
        reason: 'missing_probe',
        message: `게이트 provider "${provider.id}" 에는 probe 선언이 필요하다`
      })
      continue
    }
    seen.add(provider.id)
    providers.push(provider)
  }

  return { providers, rejected }
}

export class ProviderRegistry {
  private readonly accepted: Provider[]
  private readonly rejections: ProviderRejection[]

  constructor(declared: readonly Provider[]) {
    const { providers, rejected } = registerProviders(declared)
    this.accepted = providers
    this.rejections = rejected
  }

  list(): readonly Provider[] {
    return this.accepted
  }

  get(id: string): Provider | undefined {
    return this.accepted.find((provider) => provider.id === id)
  }

  // kind 별 조회 — 게이트 판정(`gate`)과 LLM 조인(`llm`)이 쓴다.
  byKind(kind: Provider['kind']): readonly Provider[] {
    return this.accepted.filter((provider) => provider.kind === kind)
  }

  rejected(): readonly ProviderRejection[] {
    return this.rejections
  }
}
