// SecretStore 의 네임스페이스 축소 뷰. 소비자(정적 usage provider hook · SSO 모듈)가
// 자기 네임스페이스 밖의 비밀을 읽거나 덮어쓰지 못하도록 prefix 를 강제한다.
// `provider:<providerKey>:` 네임스페이스는 usage provider 와 SSO 모듈이 공유하는
// 토큰 핸드셰이크 규약이다(0130) — SSO 가 기록한 토큰을 usage hook/`${SECRET:}` 이 읽는다.
//
// **0157 이후 이 네임스페이스에 쓰는 쪽이 없다** (0176 전수 확인). 인증 플랫폼의 자격증명은
// `auth:binding:<id>:` vault 에만 앉고 요청 주입은 broker 가 한다. 따라서 **인증이 필요한
// 사용량 호출은 이 경로가 아니라 usage connector 구독**을 쓴다
// (`contracts/usage-report.ts` §구독 경로). 이 파일은 공개 endpoint 용 `${SECRET:}` 확장과
// 무회귀를 위해 남아 있다 — 제거 시점은 미결(0176 Open Question).

// SecretStore 의 구조적 포트 — 테스트/타 소비자가 클래스 없이 만족할 수 있게 최소 표면만.
export interface SecretStorePort {
  get(name: string): string | undefined
  set(name: string, plain: string): void
  delete(name: string): void
}

interface SecretFacade {
  get(name: string): string | null
  set(name: string, value: string): void
  delete(name: string): void
}

export function createNamespacedSecretFacade(store: SecretStorePort, prefix: string): SecretFacade {
  return {
    get: (name) => store.get(`${prefix}${name}`) ?? null,
    set: (name, value) => store.set(`${prefix}${name}`, value),
    delete: (name) => store.delete(`${prefix}${name}`)
  }
}

export function providerSecretPrefix(providerKey: string): string {
  return `provider:${providerKey}:`
}
