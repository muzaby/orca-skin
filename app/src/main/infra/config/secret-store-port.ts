// `SecretStore` 의 **구조적 포트**.
//
// 별도 파일인 이유는 하나다: `secret-store.ts` 는 `electron-store` 를 물어서 vitest 에서 직접
// import 할 수 없다. 소비자(`vault`·MCP 해석)는 이 포트만 보고, 테스트는 메모리 구현을 준다.
//
// 쓰기는 봉인을 기다리므로 Promise 다(0324 EP-18). 메모리 구현은 값을 바로 돌려줘도 된다.
export interface SecretStorePort {
  get(name: string): string | undefined
  set(name: string, plain: string): void | Promise<void>
  delete(name: string): void
}
