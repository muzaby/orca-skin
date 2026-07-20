// SecretStore 의 네임스페이스 축소 뷰. 소비자(정적 usage provider hook · SSO 모듈)가
// 자기 네임스페이스 밖의 비밀을 읽거나 덮어쓰지 못하도록 prefix 를 강제한다.
// `provider:<providerKey>:` 네임스페이스는 usage provider 와 SSO 모듈이 공유하는
// 토큰 핸드셰이크 규약이다(0130) — SSO 가 기록한 토큰을 usage hook/`${SECRET:}` 이 읽는다.

// SecretStore 의 구조적 포트 — 테스트/타 소비자가 클래스 없이 만족할 수 있게 최소 표면만.
export interface SecretStorePort {
  get(name: string): string | undefined
  set(name: string, plain: string): void
  delete(name: string): void
}

export interface SecretFacade {
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
